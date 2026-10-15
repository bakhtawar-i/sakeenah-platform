# Sajaa — design reference pack (v3)
The mockups in `mockups/` are the source of truth. Match them. Where the live site differs, the mockup wins, except the privacy copy (see "Copy exceptions").

## What is in this pack
- mockups/welcome-mockup-390.png, home-mockup-390.png — the target, rendered at 390px wide (2x).
- mockups/welcome-mockup.html, home-mockup.html — the exact markup and CSS of the mockups. Open in a browser (needs Readex Pro 400/500/600 and Aref Ruqaa 700). Port sizes, positions and colours from here, do not eyeball from the picture.
- art/ — the real hand-drawn artwork, transparent. Use these files; do not redraw or substitute placeholder shapes.
  - welcome-art-layer.svg / .webp / @2x.png — the WHOLE Welcome artwork at 390x844: window (arch), cream plaque, sill, flowers, leaves, vines, wind lines, underline squiggle, x marks. Contains NO text. The SVG version already includes the sway and wind animation and a prefers-reduced-motion rule; use the -static.svg until the Motion PR.
  - home-art-top.svg (390x260) and home-art-bottom.svg (390x280): Home artwork split so top art anchors to the top of the column and bottom art to the bottom. -static versions available.
  - logo-mark.svg — the small arch icon used in the Home header next to "Sajaa".
- ../sajaa-art (separate pack) — individual flowers, leaves, app icon, favicons.

## Layout rules
1. Column: centre a column max 430px wide on desktop, full width on phones. Cream #FFF7F0 on html, body and column. No dark strip, no scroll bars from the art. Use min-h-[100dvh].
2. All artwork is positioned relative to the column, never the browser window. Art is clipped at the column edges (overflow hidden on the column).
3. WELCOME is a fixed composition, 390x844 design units. Build it as a stage of exactly that size and scale the whole stage uniformly to fit: scale = min(columnWidth/390, viewportHeight/844), capped at 1.15, centred. Text, button and art all live inside the stage so they never drift apart. No scrolling on any phone or desktop size.
4. HOME is a normal scrolling screen inside the column. Top art anchored to the column top-right, bottom art anchored to the column bottom (position absolute, pointer-events none, behind content, z-index below). Content never sits on artwork: keep text, textarea and pills clear of the flowers.
5. Everything else (Response, Journal, auth) uses the same column and the same edge-only artwork rule.

## Welcome — exact values (design units, stage 390x844)
- Art layer: full stage, absolute 0,0.
- Arabic سجى: Aref Ruqaa 700, 66px, line-height 1.3, #88393C, lang=ar dir=rtl; centred in a box left 121, top 197, width 150, height 106 (flex centre both ways). Live text, not an image. It sits inside the plaque that is part of the art layer.
- SAJAA: top 408, 13px, weight 600, letter-spacing .28em, #88393C, centred.
- Headline "Set it down here.": top 432, Readex Pro 600, 34px, line-height 1.15, #88393C, centred. (The squiggle underline is in the art layer.)
- Subline "One calm reflection a day.": top 498, 17px, line-height 1.4, #6B4244, centred.
- Begin button: left 65, top 556, 260x56, radius 28, bg #88393C, text #FFF7F0 Readex 600 17px, with arrow icon 18px, gap 10px.
- Privacy footer: top 648, left/right 30, 13px, line-height 1.55, #6B4244, centred.

## Home — exact values (see home-mockup.html for the rest)
- Header: logo-mark + "Sajaa" wordmark left; Home / Journal / Sign in right, active item underlined coral #E78861.
- Heading "What's on your mind?" 2 lines, Readex 600, maroon #88393C. Art top-right of the column, never overlapping the heading text.
- Textarea: white, 1.5px turquoise #81D1D0 border, large radius, "300 characters remaining" right-aligned below.
- Emotion pills: left-aligned, flex-wrap, 10px gap both ways, first pill starts at the same left edge as the label and textarea. Selected = solid maroon with cream text; unselected = white with thin hairline border #DECFCA. No dots. The mockup shows only two sample pills; the real list has 16.
- Reflect button: full width, maroon pill, 56px high, white space above it (>= 28px) free of artwork.
- Do not touch the crisis-support box.

## Copy exceptions
The mockup privacy footer is shortened. Keep the longer, technically accurate privacy copy already in the repo (project rule: privacy copy must be accurate). Just fit it in the same footer space; if it is too long, reduce to 12px or tighten line-height, do not cut words.

## Acceptance checklist (check every item with screenshots at 390x844 AND 1440x900)
[ ] Welcome fits one viewport, no scroll, at both sizes
[ ] Welcome at 390x844 is visually identical to welcome-mockup-390.png (window, plaque, flowers, underline, button, footer)
[ ] Plaque is cream, Arabic centred in it, not touching the plaque edge
[ ] No flower overlaps any text, input, pill or button
[ ] Artwork sits at the edges of the 430px column on desktop, not at the browser corners
[ ] Page background is cream everywhere, no dark strip at the bottom
[ ] Home pills left-aligned, equal gaps, aligned with label and textarea
[ ] Contrast: body text >= 4.5:1; axe-core reports 0 WCAG AA violations
[ ] No console errors; fonts are the self-hosted Readex Pro and Aref Ruqaa
