import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { type ConversationMessage } from "@/lib/storage";
import { format, isSameYear, startOfWeek } from "date-fns";
import { CARD, PRIMARY, REPLY_CARD, SECONDARY } from "@/components/reflection/styles";
import { EmotionPills, Paragraphs, SectionLabel, TurnRow, type Turn } from "@/components/reflection/ReflectionParts";

interface EntryRow {
  id: string;
  session_id: string;
  entry_text: string;
  emotion_labels: string[];
  ai_response: string;
  created_at: string;
  // Also returned by get_session_entries (entries.*); older rows may have no messages.
  messages?: ConversationMessage[] | null;
  turn_count?: number;
}

interface Props {
  onNavigateHome?: () => void;
}

// Past this many entries, earlier ones are grouped by month instead of one "Earlier" band.
const MONTH_GROUPS_FROM = 9;
const TITLE_WORDS = 4;
const TITLE_MAX_CHARS = 40;

/** Entries have no stored title, so the title is the first few words of what was written (never empty). */
function titleOf(entry: EntryRow): string {
  const words = entry.entry_text.trim().split(/\s+/);
  let title = words.slice(0, TITLE_WORDS).join(" ");
  const cut = words.length > TITLE_WORDS || title.length > TITLE_MAX_CHARS;
  if (title.length > TITLE_MAX_CHARS) title = title.slice(0, TITLE_MAX_CHARS).trimEnd();
  return cut ? `${title}…` : title || "A reflection";
}

function reflectionCount(entry: EntryRow): string {
  const n = Math.max(1, entry.turn_count ?? 1);
  return `${n} ${n === 1 ? "reflection" : "reflections"}`;
}

/** Follow-up exchanges after the first reply, numbered from 2 like the Response screen. */
function followUps(entry: EntryRow): Turn[] {
  const messages = entry.messages ?? [];
  const turns: Turn[] = [];
  for (let i = 2; i + 1 < messages.length; i += 2) {
    turns.push({ number: i / 2 + 1, wrote: messages[i].content, reply: messages[i + 1].content });
  }
  return turns;
}

function groupEntries(entries: EntryRow[], now: Date): { label: string; entries: EntryRow[] }[] {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const groups: { label: string; entries: EntryRow[] }[] = [];
  const add = (label: string, entry: EntryRow) => {
    const last = groups[groups.length - 1];
    if (last?.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  };
  for (const entry of entries) {
    const date = new Date(entry.created_at);
    if (date >= weekStart) add("THIS WEEK", entry);
    else if (entries.length >= MONTH_GROUPS_FROM) add(format(date, isSameYear(date, now) ? "MMMM" : "MMMM yyyy").toUpperCase(), entry);
    else add("EARLIER", entry);
  }
  return groups;
}

const HEADING = "font-display max-w-[min(230px,calc(100%-117px))] text-[30px] font-semibold leading-[1.2] text-maroon";
const SUBLINE = "mt-3 max-w-[300px] text-[15px] leading-[1.5] text-clay-deep";
const MESSAGE_CARD = "rounded-[20px] border border-hairline bg-white px-6 py-[34px] text-center";

function ChevronIcon({ path, color }: { path: string; color: string }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={path} />
    </svg>
  );
}

function EntryCard({ entry, now, onOpen }: { entry: EntryRow; now: Date; onOpen: () => void }) {
  const date = new Date(entry.created_at);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-[10px] block w-full rounded-[20px] border border-hairline bg-white px-4 pb-[14px] pt-4 text-left leading-[normal] transition-colors hover:border-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium tracking-[0.04em] text-clay">
          {format(date, isSameYear(date, now) ? "EEE d MMM" : "EEE d MMM yyyy").toUpperCase()}
        </span>
        <ChevronIcon path="M9 6l6 6-6 6" color="#7A5558" />
      </span>
      <span className="mt-[6px] line-clamp-2 break-words text-[17px] font-semibold leading-[1.3] text-maroon">{titleOf(entry)}</span>
      <span className="mt-[6px] line-clamp-2 break-words text-[15px] leading-[1.5] text-clay-deep">{entry.entry_text}</span>
      <span className="mt-3 flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-wrap gap-2">
          {entry.emotion_labels?.map((e) => (
            <span key={e} className="flex h-[26px] items-center rounded-[13px] border border-hairline bg-cream px-[11px] text-[12.5px] leading-none text-ink">
              {e}
            </span>
          ))}
        </span>
        <span className="shrink-0 text-[12.5px] text-clay">{reflectionCount(entry)}</span>
      </span>
    </button>
  );
}

function EntryView({ entry, onBack }: { entry: EntryRow; onBack: () => void }) {
  const [openTurn, setOpenTurn] = useState<number | null>(null);
  const date = new Date(entry.created_at);
  const turns = followUps(entry);
  return (
    <div className="animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="mt-[14px] flex items-center gap-[6px] rounded-sm text-[15px] font-medium leading-[normal] text-maroon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
      >
        <ChevronIcon path="M15 6l-6 6 6 6" color="#88393C" />
        Journal
      </button>
      <h2 className={`mt-[18px] line-clamp-3 break-words ${HEADING}`}>{titleOf(entry)}</h2>
      <p className="mt-2 text-[13px] leading-[normal] text-clay">
        {format(date, isSameYear(date, new Date()) ? "EEEE d MMMM" : "EEEE d MMMM yyyy")} · {reflectionCount(entry)}
      </p>

      <SectionLabel className="mt-6">YOU WROTE</SectionLabel>
      <p className={`mt-2 whitespace-pre-line break-words text-[15px] leading-[1.5] text-clay-deep ${CARD}`}>{entry.entry_text}</p>
      <EmotionPills emotions={entry.emotion_labels ?? []} />

      <SectionLabel className="mt-7">A REFLECTION FOR YOU</SectionLabel>
      <div className={`mt-2 break-words ${REPLY_CARD}`}>
        <Paragraphs text={entry.ai_response} />
      </div>

      {turns.length > 0 && (
        <>
          <SectionLabel className="mt-[30px]">FOLLOW-UPS</SectionLabel>
          <div className="mt-3 flex flex-col gap-3">
            {turns.map((turn) => (
              <TurnRow
                key={turn.number}
                turn={turn}
                emotions={[]}
                expanded={openTurn === turn.number}
                onToggle={() => setOpenTurn(openTurn === turn.number ? null : turn.number)}
              />
            ))}
          </div>
        </>
      )}

      <button type="button" onClick={onBack} className={`mt-7 ${SECONDARY}`}>
        Back to Journal
      </button>
    </div>
  );
}

export default function JournalScreen({ onNavigateHome }: Props) {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<{ id: string; scrollY: number } | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(false);

    const { data, error: fetchError } = await supabase.rpc(
      "get_session_entries" as never,
      { p_session_id: getSessionId() } as never,
    );

    if (fetchError) {
      setEntries([]);
      setError(true);
      setLoading(false);
      return;
    }

    setEntries((data as EntryRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const open = (id: string) => {
    setSelected({ id, scrollY: window.scrollY });
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    const scrollY = selected?.scrollY ?? 0;
    setSelected(null);
    // Return to where the list was once it has rendered again.
    requestAnimationFrame(() => window.scrollTo({ top: scrollY }));
  };

  const selectedEntry = selected && entries.find((e) => e.id === selected.id);
  if (selectedEntry) return <EntryView entry={selectedEntry} onBack={back} />;

  const now = new Date();

  return (
    <div className="animate-fade-in pt-6">
      <h2 className={HEADING}>Your journal.</h2>

      {loading ? (
        <p role="status" className="mt-9 text-center text-[15px] text-clay">
          Loading entries...
        </p>
      ) : error ? (
        // No subline here, so the card starts lower to land where the empty-state card does, clear of the top artwork.
        <div role="alert" className={`mt-[70px] ${MESSAGE_CARD}`}>
          <p className="text-[17px] font-semibold leading-[1.35] text-maroon">We could not load your reflections right now.</p>
          <p className="mt-2 text-[15px] leading-[1.55] text-clay-deep">Please try again.</p>
          <button type="button" onClick={() => void fetchEntries()} className={`mt-[22px] ${PRIMARY}`}>
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <>
          <p className={SUBLINE}>Your past reflections will gather here.</p>
          <div className={`mt-9 ${MESSAGE_CARD}`}>
            <p className="text-[17px] font-semibold leading-[1.35] text-maroon">Nothing here yet.</p>
            <p className="mt-2 text-[15px] leading-[1.55] text-clay-deep">
              When you finish a reflection and save it, it will be here for you to look back on.
            </p>
            {onNavigateHome && (
              <button type="button" onClick={onNavigateHome} className={`mt-[22px] ${PRIMARY}`}>
                Begin a reflection
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className={SUBLINE}>Your past reflections, newest first.</p>
          {groupEntries(entries, now).map((group, i) => (
            <section key={group.label} aria-label={group.label.toLowerCase()}>
              <h3 className={`${i === 0 ? "mt-[26px]" : "mt-[30px]"} text-[13px] font-medium leading-[normal] tracking-[0.04em] text-clay`}>{group.label}</h3>
              {group.entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} now={now} onOpen={() => open(entry.id)} />
              ))}
            </section>
          ))}
          <p className="mt-[22px] text-center text-[13px] leading-[normal] text-clay">That is everything for now.</p>
        </>
      )}
    </div>
  );
}
