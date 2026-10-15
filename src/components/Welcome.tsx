import { useEffect, useRef, type KeyboardEvent } from "react";
import ArtImage from "@/components/art/ArtImage";
import ScreenFrame from "@/components/layout/ScreenFrame";

interface Props {
  /** Close the Welcome screen and return to wherever the user was. */
  onBegin: () => void;
}

/**
 * v3 Welcome screen, shown as a full-screen dialog over the app so the page
 * underneath (including any Home draft) stays mounted while it is open.
 */
export default function Welcome({ onBegin }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

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
      className="fixed inset-0 z-50 overflow-y-auto bg-cream"
    >
      <ScreenFrame topArt compactArt contentClassName="items-center px-6 text-center">
        {/* Spare height falls above the arch and below the footer; the groups keep even 20px gaps. */}
        <div className="flex-1" aria-hidden="true" />

        <div className="flex flex-col items-center gap-5 py-2 animate-fade-in">
          <div className="relative h-[260px] w-[180px] shrink-0">
            <ArtImage name="welcome-arch" width={180} height={260} className="absolute inset-0 h-full w-full" />
            <span className="absolute left-1/2 top-[146px] flex h-14 w-24 -translate-x-1/2 items-center justify-center rounded-lg bg-cream">
              <span lang="ar" dir="rtl" className="translate-y-[7px] font-arabic text-[26px] font-bold leading-none text-maroon">
                سجى
              </span>
            </span>
          </div>

          <div>
            <p className="text-sm font-semibold tracking-[0.3em] text-maroon">SAJAA</p>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-2 text-[28px] font-semibold leading-tight text-maroon focus:outline-none"
            >
              Set it down here.
            </h1>
            <p className="mt-1 text-[15px] text-clay">One calm reflection a day.</p>
          </div>

          <button
            type="button"
            onClick={onBegin}
            className="rounded-full bg-maroon px-10 py-3 text-sm font-medium text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          >
            Begin
          </button>

          <div className="space-y-2 text-[13px] leading-relaxed text-clay">
            <p>
              Your reflections are stored privately and securely. They are used only to generate your responses and are never sold or shared for advertising.
            </p>
            <p>Sajaa is a space for reflection, not a replacement for professional support.</p>
          </div>
        </div>

        <div className="flex-1" aria-hidden="true" />
      </ScreenFrame>
    </div>
  );
}
