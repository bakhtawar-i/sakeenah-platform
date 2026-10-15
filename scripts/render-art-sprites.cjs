/*
 * Splits each animated artwork layer into a still base and one transparent
 * WebP sprite per swaying flower or leaf, so the page can animate the
 * sprites with CSS transforms only. Animating the SVG directly re-runs its
 * gouache filter on the main thread every frame, which is too slow on phones.
 *
 * Inputs:  public/art/svg/<layer>-static.svg (the drawing, without animation)
 * Outputs: public/art/motion/<layer>/{base,over,sway-NN}@2x.webp
 *          src/components/art/motionLayers.ts (positions, pivots, delays, wind paths)
 *
 * Re-run only when the drawing changes. Needs Playwright with Chromium, which
 * is not a project dependency:
 *   NODE_PATH=$(npm root -g) node scripts/render-art-sprites.cjs
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const LAYERS = ["welcome-art-layer", "home-art-top", "home-art-bottom"];
const DPR = 2;
// Margin around each sprite's bounding box: covers the filter's displacement and stroke offsets.
const PAD = 6;
// Sway reach used to decide whether an off-canvas group can ever swing into view.
const MAX_SWAY_DEG = 8;

async function renderLayer(page, layer) {
  const svgText = fs.readFileSync(path.join(ROOT, "public/art/svg", `${layer}-static.svg`), "utf8");
  return page.evaluate(
    async ({ svgText, DPR, PAD, MAX_SWAY_DEG }) => {
      const host = document.createElement("div");
      host.innerHTML = svgText;
      const svg = host.querySelector("svg");
      document.body.appendChild(host);
      const [VX, VY, W, H] = svg.getAttribute("viewBox").split(/\s+/).map(Number);

      const sways = [...svg.querySelectorAll("g.sway")];
      const winds = [...svg.querySelectorAll("path.wind")];

      // Still shapes drawn after the first sway group (the Welcome arch, for one) must stay on top
      // of the sprites, so they go in a separate "over" image instead of the base.
      const drawn = [...svg.querySelectorAll("path, use, circle, rect, ellipse, polygon, polyline, line, image, text")].filter(
        (el) => !el.closest("defs, clipPath, mask, g.sway") && !el.classList.contains("wind"),
      );
      const over = sways.length ? drawn.filter((el) => sways[0].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) : [];
      over.forEach((el) => el.setAttribute("data-over", ""));
      const svgRect = svg.getBoundingClientRect();
      const overBox = (() => {
        if (!over.length) return null;
        const rects = over.map((el) => el.getBoundingClientRect());
        const x0 = Math.max(VX, Math.floor(Math.min(...rects.map((r) => r.left)) - svgRect.left + VX - PAD));
        const y0 = Math.max(VY, Math.floor(Math.min(...rects.map((r) => r.top)) - svgRect.top + VY - PAD));
        const x1 = Math.min(VX + W, Math.ceil(Math.max(...rects.map((r) => r.right)) - svgRect.left + VX + PAD));
        const y1 = Math.min(VY + H, Math.ceil(Math.max(...rects.map((r) => r.bottom)) - svgRect.top + VY + PAD));
        return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
      })();

      // Measure every sway group in user units and drop the ones that can never be seen.
      const groups = sways.map((g, index) => {
        const b = g.getBBox();
        const [ox, oy] = g.style.transformOrigin.split(" ").map(parseFloat);
        const delay = parseFloat(g.style.animationDelay);
        const x0 = Math.floor(b.x - PAD), y0 = Math.floor(b.y - PAD);
        const x1 = Math.ceil(b.x + b.width + PAD), y1 = Math.ceil(b.y + b.height + PAD);
        const reach = Math.hypot(Math.max(Math.abs(x0 - ox), Math.abs(x1 - ox)), Math.max(Math.abs(y0 - oy), Math.abs(y1 - oy)));
        const slack = reach * Math.sin((MAX_SWAY_DEG * Math.PI) / 180);
        const visible = x1 + slack > VX && x0 - slack < VX + W && y1 + slack > VY && y0 - slack < VY + H;
        return { index, x: x0, y: y0, w: x1 - x0, h: y1 - y0, ox, oy, delay, visible };
      });

      // Render one part of the drawing ("base", "over" or a sway group's index) into a canvas
      // region at DPR, as a WebP data URL. Everything else is hidden, so filters stay in place.
      const render = async (show, box) => {
        const clone = svg.cloneNode(true);
        clone.setAttribute("visibility", show === "base" ? "visible" : "hidden");
        clone.querySelectorAll("g.sway").forEach((g, i) => g.setAttribute("visibility", i === show ? "visible" : "hidden"));
        clone.querySelectorAll("path.wind").forEach((p) => p.setAttribute("visibility", "hidden"));
        clone.querySelectorAll("[data-over]").forEach((el) => el.setAttribute("visibility", show === "over" ? "visible" : "hidden"));
        // Clip paths and masks inherit visibility too, and a hidden clip shape clips everything away.
        clone.querySelectorAll("defs, clipPath, mask").forEach((el) => el.setAttribute("visibility", "visible"));
        clone.setAttribute("viewBox", `${box.x} ${box.y} ${box.w} ${box.h}`);
        clone.setAttribute("width", box.w * DPR);
        clone.setAttribute("height", box.h * DPR);
        clone.setAttribute("overflow", "visible");
        const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
        const img = new Image();
        img.src = url;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = box.w * DPR;
        canvas.height = box.h * DPR;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/webp", 0.92);
      };

      const base = await render("base", { x: VX, y: VY, w: W, h: H });
      const overImage = overBox && { ...overBox, data: await render("over", overBox) };
      const sprites = [];
      for (const g of groups.filter((g) => g.visible)) {
        sprites.push({ ...g, data: await render(g.index, g) });
      }
      // Wind lines: the page masks a sliding strip of dashes with each line's shape. The strip
      // moves along x, so the dash period along the curve is converted to x units.
      const wind = winds
        .map((p) => {
          const b = p.getBBox();
          const length = p.getTotalLength();
          const start = p.getPointAtLength(0);
          const end = p.getPointAtLength(length);
          const x0 = Math.floor(b.x - 2), y0 = Math.floor(b.y - 2);
          const x1 = Math.ceil(b.x + b.width + 2), y1 = Math.ceil(b.y + b.height + 2);
          return {
            d: p.getAttribute("d"),
            stroke: p.getAttribute("stroke"),
            delay: parseFloat(p.style.animationDelay),
            x: x0, y: y0, width: x1 - x0, height: y1 - y0,
            startX: start.x,
            // stroke-dasharray 46 38 repeats every 84 units along the curve.
            period: +((84 * (end.x - start.x)) / length).toFixed(3),
          };
        })
        // Wind lines outside this layer's viewBox belong to the other half of the Home drawing.
        .filter((w) => w.x + w.width > VX && w.x < VX + W && w.y + w.height > VY && w.y < VY + H);
      host.remove();
      return { VX, VY, W, H, base, over: overImage, sprites, wind };
    },
    { svgText, DPR, PAD, MAX_SWAY_DEG },
  );
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent("<!doctype html><body style='margin:0'></body>");
  const manifest = {};
  for (const layer of LAYERS) {
    const { VX, VY, W, H, base, over, sprites, wind } = await renderLayer(page, layer);
    const dir = path.join(ROOT, "public/art/motion", layer);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const save = (name, dataUrl) => fs.writeFileSync(path.join(dir, `${name}@2x.webp`), Buffer.from(dataUrl.split(",")[1], "base64"));
    save("base", base);
    if (over) save("over", over.data);
    manifest[layer] = {
      // The SVG viewBox; sprite positions and pivots below are relative to its top-left corner.
      viewBox: [VX, VY, W, H],
      over: over && { src: `/art/motion/${layer}/over@2x.webp`, x: over.x - VX, y: over.y - VY, width: over.w, height: over.h },
      sway: sprites.map((s, i) => {
        const name = `sway-${String(i + 1).padStart(2, "0")}`;
        save(name, s.data);
        return {
          src: `/art/motion/${layer}/${name}@2x.webp`,
          x: s.x - VX,
          y: s.y - VY,
          width: s.w,
          height: s.h,
          originX: s.ox - VX,
          originY: s.oy - VY,
          delay: s.delay,
        };
      }),
      wind: wind.map((w) => ({ ...w, x: w.x - VX, y: w.y - VY, startX: +(w.startX - VX).toFixed(3) })),
    };
    console.log(`${layer}: base${over ? " + over" : ""} + ${sprites.length} sway sprites, ${wind.length} wind lines`);
  }
  await browser.close();

  const ts =
    "// Generated by scripts/render-art-sprites.cjs. Do not edit by hand.\n" +
    "// Units are SVG user units relative to the viewBox corner; delays are seconds (negative = already running).\n\n" +
    'import type { MotionLayer } from "@/components/art/MotionArt";\n\n' +
    `export const MOTION_LAYERS = ${JSON.stringify(manifest, null, 2)} as const satisfies Record<string, MotionLayer>;\n`;
  fs.writeFileSync(path.join(ROOT, "src/components/art/motionLayers.ts"), ts);
})();
