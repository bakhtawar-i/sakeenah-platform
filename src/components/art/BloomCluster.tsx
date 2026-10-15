import { cn } from "@/lib/utils";

interface Props {
  /** Rendered width and height in px. */
  size: number;
  /** Mirror horizontally, e.g. for a bottom-left corner cluster. */
  flip?: boolean;
  className?: string;
}

/**
 * Decorative bougainvillea cluster.
 *
 * Placeholder shapes until the hand-drawn artwork lands in public/art/.
 * Callers position it at screen edges only (never behind text, inputs or
 * pills); it is hidden from assistive tech and ignores pointer events.
 */
export default function BloomCluster({ size, flip = false, className }: Props) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("pointer-events-none select-none", flip && "-scale-x-100", className)}
    >
      {/* twig */}
      <path d="M96 98 C78 80 66 66 52 46" fill="none" stroke="hsl(var(--clay))" strokeWidth="2" strokeLinecap="round" />
      {/* leaves */}
      <ellipse cx="74" cy="70" rx="13" ry="6" transform="rotate(-35 74 70)" fill="hsl(var(--turquoise))" />
      <ellipse cx="60" cy="76" rx="11" ry="5" transform="rotate(20 60 76)" fill="hsl(var(--mint))" />
      {/* bracts */}
      <circle cx="46" cy="38" r="13" fill="hsl(var(--bloom-magenta))" />
      <circle cx="32" cy="48" r="11" fill="hsl(var(--bloom-pink))" />
      <circle cx="56" cy="26" r="10" fill="hsl(var(--bloom-red))" />
      <circle cx="30" cy="30" r="8" fill="hsl(var(--bloom-orange))" />
      <circle cx="44" cy="54" r="7" fill="hsl(var(--bloom-pink))" />
    </svg>
  );
}
