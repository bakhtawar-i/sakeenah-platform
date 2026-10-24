import { useEffect, useState } from "react";
import ArtImage from "@/components/art/ArtImage";
import { MOTION_LAYERS } from "@/components/art/motionLayers";
import { cn } from "@/lib/utils";

export interface MotionLayer {
  viewBox: readonly [number, number, number, number];
  /** Still shapes drawn above the swaying pieces in the original drawing. */
  over: { src: string; x: number; y: number; width: number; height: number } | null;
  sway: readonly {
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    originX: number;
    originY: number;
    delay: number;
  }[];
  wind: readonly {
    d: string;
    stroke: string;
    delay: number;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Where the line starts, and its dash period measured along x. */
    startX: number;
    period: number;
  }[];
}

interface Props {
  name: keyof typeof MOTION_LAYERS;
  /** Sizes and positions the layer, like ArtImage's className. */
  className?: string;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia(REDUCED_MOTION).matches);
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION);
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

const percent = (part: number, whole: number) => `${(part / whole) * 100}%`;

/**
 * An artwork layer whose flowers and leaves sway and whose wind lines drift.
 *
 * The drawing's gouache filter is too expensive to recalculate every frame,
 * so each swaying piece is a pre-rendered sprite (scripts/render-art-sprites.cjs)
 * rotated with a CSS transform over a still base, and each wind line is a strip
 * of dashes sliding behind a mask of the line. Only transforms animate, so the
 * compositor runs the motion without repainting. With reduced motion the static
 * artwork is shown instead.
 *
 * Decorative only: hidden from assistive tech and ignores pointer events.
 */
export default function MotionArt({ name, className }: Props) {
  const reduced = usePrefersReducedMotion();
  const layer: MotionLayer = MOTION_LAYERS[name];
  const [left, top, width, height] = layer.viewBox;

  if (reduced) return <ArtImage name={name} width={width} height={height} className={className} />;

  return (
    // overflow-hidden clips the sprites to the layer, as the SVG viewport clips the original drawing.
    <div
      aria-hidden="true"
      className={cn("pointer-events-none relative select-none overflow-hidden", className)}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <img
        src={`/art/motion/${name}/base@2x.webp`}
        alt=""
        width={width}
        height={height}
        draggable={false}
        decoding="async"
        className="absolute inset-0 block h-full w-full"
      />
      {layer.sway.map((piece) => (
        <img
          key={piece.src}
          src={piece.src}
          alt=""
          width={piece.width}
          height={piece.height}
          draggable={false}
          decoding="async"
          className="art-sway absolute block max-w-none"
          style={{
            left: percent(piece.x, width),
            top: percent(piece.y, height),
            width: percent(piece.width, width),
            height: percent(piece.height, height),
            transformOrigin: `${percent(piece.originX - piece.x, piece.width)} ${percent(piece.originY - piece.y, piece.height)}`,
            animationDelay: `${piece.delay}s`,
          }}
        />
      ))}
      {layer.over && (
        <img
          src={layer.over.src}
          alt=""
          width={layer.over.width}
          height={layer.over.height}
          draggable={false}
          decoding="async"
          className="absolute block max-w-none"
          style={{
            left: percent(layer.over.x, width),
            top: percent(layer.over.y, height),
            width: percent(layer.over.width, width),
            height: percent(layer.over.height, height),
          }}
        />
      )}
      {layer.wind.map((line) => {
        // The line's own shape masks a strip of dashes that slides along x (see .art-wind).
        const mask = `url("data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${line.x + left} ${line.y + top} ${line.width} ${line.height}" preserveAspectRatio="none">` +
            `<path d="${line.d}" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round"/></svg>`,
        )}") 0 0 / 100% 100% no-repeat`;
        return (
          <div
            key={line.d}
            className="absolute"
            style={{
              left: percent(line.x, width),
              top: percent(line.y, height),
              width: percent(line.width, width),
              height: percent(line.height, height),
              mask,
              WebkitMask: mask,
            }}
          >
            <div
              className="art-wind absolute inset-y-0"
              style={{
                left: percent(line.startX - line.x - 3 * line.period, line.width),
                width: percent(6 * line.period, line.width),
                color: line.stroke,
                animationDelay: `${line.delay}s`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
