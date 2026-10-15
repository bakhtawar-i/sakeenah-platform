import type { ReactNode } from "react";
import ArtImage from "@/components/art/ArtImage";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** Classes for the flex column that holds the screen's content. */
  contentClassName?: string;
}

/**
 * The app's centred column: max 430px wide, full width on phones, at least one
 * dynamic viewport tall. Corner artwork is positioned at the column's corners
 * (not the browser's), and an equally tall spacer reserves its band so the art
 * never sits behind text, inputs or pills.
 */
export default function ScreenFrame({ children, contentClassName }: Props) {
  const artWidth = "w-[44%]";
  // Corner pieces are 390x300 artwork, so the reserved band keeps that 13:10 ratio.
  const band = <div aria-hidden="true" className={cn(artWidth, "aspect-[13/10] shrink-0")} />;

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-cream">
      <div className={cn("flex flex-1 flex-col", contentClassName)}>{children}</div>

      {band}
      <ArtImage name="corner-bottom-left" width={195} height={150} className={cn("absolute bottom-0 left-0", artWidth)} />
      <ArtImage name="corner-bottom-right" width={195} height={150} className={cn("absolute bottom-0 right-0", artWidth)} />
    </div>
  );
}
