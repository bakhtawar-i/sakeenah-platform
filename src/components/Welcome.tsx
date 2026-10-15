import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import ArtImage from "@/components/art/ArtImage";
import { COLUMN_CLASS } from "@/components/layout/column";
import { cn } from "@/lib/utils";

interface Props {
  /** Close the Welcome screen and return to wherever the user was. */
  onBegin: () => void;
}

// Welcome is a fixed composition in design units (design-reference/SPEC.md).
const STAGE_WIDTH = 390;
const STAGE_HEIGHT = 844;
const MAX_SCALE = 1.15;
// Up to this many design units of art may be cropped off the top and bottom (all text sits
// between y 197 and 734), so the stage can fill the column width instead of leaving side gaps.
const MAX_VERTICAL_CROP = 60;

/**
 * v3 Welcome screen, shown as a full-screen dialog over the app so the page
 * underneath (including any Home draft) stays mounted while it is open.
 *
 * Art, text and button all live on one 390x844 stage that is scaled as a
 * whole to fill the column width, so they never drift apart and nothing
 * scrolls. Art beyond the column (or its card edge on desktop) is cropped.
 */
export default function Welcome({ onBegin }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    const fit = () =>
      setScale(
        Math.min(
          column.clientWidth / STAGE_WIDTH,
          column.clientHeight / (STAGE_HEIGHT - 2 * MAX_VERTICAL_CROP),
          MAX_SCALE,
        ),
      );
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(column);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    headingRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      // Return focus to whatever opened the Welcome (header wordmark or About link).
      if (trigger && trigger !== document.body && trigger.isConnected) trigger.focus();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onBegin();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Sajaa"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 overflow-hidden bg-cream min-[431px]:bg-blush"
    >
      <div ref={columnRef} className={cn(COLUMN_CLASS, "h-[100dvh] min-[431px]:h-[calc(100dvh-48px)]")}>
        <div
          className="absolute left-1/2 top-1/2 h-[844px] w-[390px]"
          style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          {/* The fade lives on this inner layer: its keyframes animate transform, which would override the stage scale. */}
          <div className="absolute inset-0 animate-fade-in">
            {/* The whole Welcome artwork (window, plaque, sill, flowers, lines); contains no text. */}
            <ArtImage name="welcome-art-layer" width={STAGE_WIDTH} height={STAGE_HEIGHT} className="absolute left-0 top-0 h-[844px] w-[390px]" />

            <div className="absolute left-[121px] top-[197px] flex h-[106px] w-[150px] items-center justify-center">
              {/* The self-hosted three-letter Aref Ruqaa subset has different vertical metrics from the full font,
                  so the glyphs render 11px high; the offset puts the ink where the mockup has it. */}
              <span lang="ar" dir="rtl" className="relative top-[11px] block font-arabic text-[66px] font-bold leading-[1.3] text-maroon">
                سجى
              </span>
            </div>

            <p className="absolute inset-x-0 top-[408px] text-center text-[13px] font-semibold leading-normal tracking-[0.28em] text-maroon">
              SAJAA
            </p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="absolute inset-x-0 top-[432px] text-center text-[34px] font-semibold leading-[1.15] text-maroon focus:outline-none"
            >
              Set it down here.
            </h1>
            <p className="absolute inset-x-0 top-[498px] text-center text-[17px] leading-[1.4] text-clay-deep">
              One calm reflection a day.
            </p>

            <button
              type="button"
              onClick={onBegin}
              className="absolute left-[65px] top-[556px] flex h-[56px] w-[260px] items-center justify-center gap-[10px] rounded-[28px] bg-maroon text-[17px] font-semibold text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              Begin
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>

            <div className="absolute inset-x-[30px] top-[648px] text-center text-[12px] leading-[1.45] text-clay-deep">
              <p>
                Your reflections are stored privately and securely. They are used only to generate your responses and are never sold or shared for advertising.
              </p>
              <p>Sajaa is a space for reflection, not a replacement for professional support.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
