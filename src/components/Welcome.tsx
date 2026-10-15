import { useEffect, useRef, type KeyboardEvent } from "react";
import BloomCluster from "@/components/art/BloomCluster";

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
      <div className="mx-auto flex min-h-full max-w-[420px] flex-col px-6">
        {/* Artwork lives in reserved strips above and below the content, never behind it. */}
        <div className="relative h-20 shrink-0" aria-hidden="true">
          <BloomCluster size={80} className="absolute -right-6 top-0 -scale-y-100" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in">
          <div className="flex h-48 w-40 items-center justify-center rounded-t-full border border-hairline bg-blush pt-6">
            <span lang="ar" dir="rtl" className="font-arabic text-[64px] font-bold leading-none text-maroon">
              سجى
            </span>
          </div>

          <p className="mt-6 text-sm font-semibold tracking-[0.3em] text-maroon">SAJAA</p>

          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-4 text-[28px] font-semibold leading-tight text-ink focus:outline-none"
          >
            Set it down here.
          </h1>
          <p className="mt-2 text-[15px] text-clay">One calm reflection a day.</p>

          <button
            type="button"
            onClick={onBegin}
            className="mt-8 rounded-full bg-maroon px-10 py-3 text-sm font-medium text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          >
            Begin
          </button>

          <div className="mt-10 space-y-2 text-[11px] leading-relaxed text-clay">
            <p>
              Your reflections are stored privately and securely. They are used only to generate your responses and are never sold or shared for advertising.
            </p>
            <p>Sajaa is a space for reflection, not a replacement for professional support.</p>
          </div>
        </div>

        <div className="relative -mx-6 mt-8 h-24 shrink-0" aria-hidden="true">
          <BloomCluster size={88} flip className="absolute bottom-0 left-0" />
          <BloomCluster size={88} className="absolute bottom-0 right-0" />
        </div>
      </div>
    </div>
  );
}
