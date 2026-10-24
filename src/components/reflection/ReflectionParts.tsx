import { useId } from "react";
import { LABEL } from "@/components/reflection/styles";

export interface Turn {
  number: number;
  wrote: string;
  reply: string;
}

/** The model's text exactly as returned, as plain paragraphs (blank lines separate them). */
export function Paragraphs({ text }: { text: string }) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <>
      {paragraphs.map((p, i) => (
        <p key={i} className={`whitespace-pre-line ${i > 0 ? "mt-4" : ""}`}>
          {p}
        </p>
      ))}
    </>
  );
}

/** Section label row; the "n of 4" turn counter sits on the right from turn 2. */
export function SectionLabel({ children, counter, className = "" }: { children: string; counter?: string; className?: string }) {
  return (
    <div className={`flex justify-between ${LABEL} ${className}`}>
      <span>{children}</span>
      {counter && <span>{counter}</span>}
    </div>
  );
}

/** An earlier turn, collapsed to a 52px row; tap or press to expand it. */
export function TurnRow({ turn, emotions, expanded, onToggle }: { turn: Turn; emotions: string[]; expanded: boolean; onToggle: () => void }) {
  const panelId = useId();
  const firstLine = turn.wrote.split("\n")[0];
  return (
    <div className="rounded-[16px] border border-hairline bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex h-[50px] w-full items-center justify-between gap-3 rounded-[16px] px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon"
      >
        <span className="min-w-0">
          <span className="block text-[11.5px] font-medium leading-[normal] tracking-[0.05em] text-clay">REFLECTION {turn.number}</span>
          {/* There is no model title per turn, so the row shows the start of what the person wrote. */}
          <span className="mt-px block truncate text-[15px] font-semibold leading-[normal] text-maroon">{firstLine}</span>
        </span>
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#7A5558"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {expanded && (
        <div id={panelId} className="border-t border-hairline px-4 pb-4 pt-[14px]">
          <SectionLabel>YOU WROTE</SectionLabel>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-[1.5] text-clay-deep">{turn.wrote}</p>
          {turn.number === 1 && <EmotionPills emotions={emotions} />}
          <SectionLabel className="mt-4">A REFLECTION FOR YOU</SectionLabel>
          <div className="mt-2 text-[15.5px] leading-[1.6] text-ink">
            <Paragraphs text={turn.reply} />
          </div>
        </div>
      )}
    </div>
  );
}

export function EmotionPills({ emotions }: { emotions: string[] }) {
  if (emotions.length === 0) return null;
  return (
    <div className="mt-[10px] flex flex-wrap gap-2">
      {emotions.map((e) => (
        <span key={e} className="flex h-[26px] items-center rounded-[13px] border border-hairline bg-cream px-[11px] text-[12.5px] leading-none text-ink">
          {e}
        </span>
      ))}
    </div>
  );
}

