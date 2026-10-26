import type { ReactNode } from "react";
import ArtImage from "@/components/art/ArtImage";
import MotionArt from "@/components/art/MotionArt";
import { cn } from "@/lib/utils";
import { COLUMN_CLASS } from "@/components/layout/column";

interface Props {
  children: ReactNode;
  /** Classes for the flex column that holds the screen's content. */
  contentClassName?: string;
  /** "home" uses the Home artwork (top-right and bottom); everything else uses the two corner pieces. */
  art?: "corners" | "home";
}

/**
 * Every screen renders inside this column (see column.ts). Artwork is placed
 * relative to the column, never the window, and a reserved band at the bottom
 * keeps the bottom art clear of content.
 */
export default function ScreenFrame({ children, contentClassName, art = "corners" }: Props) {
  return (
    <div className={cn(COLUMN_CLASS, "flex min-h-[100dvh] flex-col min-[431px]:min-h-[calc(100dvh-48px)]")}>
      {art === "home" && (
        // Native 390px size, anchored top-right: its ink sits right of the heading and above the textarea.
        <MotionArt name="home-art-top" className="absolute right-0 top-0 w-[390px] max-w-none" />
      )}

      <div className={cn("relative flex flex-1 flex-col", contentClassName)}>{children}</div>

      {art === "home" ? (
        <>
          {/* Bottom art scales to the column width; this band reserves its full height. */}
          <div aria-hidden="true" className="aspect-[390/280] w-full shrink-0" />
          <MotionArt name="home-art-bottom" className="absolute bottom-0 left-0 w-full" />
        </>
      ) : (
        <>
          {/* Corner pieces are 390x300 artwork, so the reserved band keeps that 13:10 ratio. */}
          <div aria-hidden="true" className="aspect-[13/10] w-[44%] shrink-0" />
          <ArtImage name="corner-bottom-left" width={195} height={150} className="absolute bottom-0 left-0 w-[44%]" />
          <ArtImage name="corner-bottom-right" width={195} height={150} className="absolute bottom-0 right-0 w-[44%]" />
        </>
      )}
    </div>
  );
}
