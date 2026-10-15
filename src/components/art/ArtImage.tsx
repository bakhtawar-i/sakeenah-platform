import { cn } from "@/lib/utils";

/** Artwork in public/art/: each has webp/<name>@2x.webp and svg/<name>.svg. */
export type ArtName =
  | "corner-top-right"
  | "corner-bottom-left"
  | "corner-bottom-right"
  | "welcome-art-layer"
  | `flower-${"a" | "b"}-${"magenta" | "pink" | "red" | "orange"}`;

interface Props {
  name: ArtName;
  /** Intrinsic display size in CSS px (half the @2x pixel size); CSS may scale it down. */
  width: number;
  height: number;
  className?: string;
}

/**
 * Decorative hand-drawn artwork: WebP with an SVG fallback.
 *
 * Purely decorative, so it is hidden from assistive tech and ignores
 * pointer events. Callers place it at screen edges only, never behind
 * text, inputs or pills.
 */
export default function ArtImage({ name, width, height, className }: Props) {
  return (
    // The <picture> is the sized, positioned box (className goes here); the img fills it.
    <picture aria-hidden="true" className={cn("pointer-events-none block select-none", className)}>
      <source type="image/webp" srcSet={`/art/webp/${name}@2x.webp 2x`} />
      <img
        src={`/art/svg/${name}.svg`}
        alt=""
        width={width}
        height={height}
        draggable={false}
        decoding="async"
        className="block h-full w-full"
      />
    </picture>
  );
}
