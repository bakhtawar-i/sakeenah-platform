import { useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type JournalEntry, type ConversationMessage } from "@/lib/storage";

interface Props {
  entry: JournalEntry;
  isAuthenticated: boolean;
  onSaveReflection: () => void;
  onViewJournal: () => void;
  onGoHome: () => void;
  onEntryUpdate: (entry: JournalEntry) => void;
}

const MAX_TURNS = 4;
const MAX_REPLY_CHARS = 1000;

// The model does not return a title, so the heading is a short fixed line.
const HEADING = "Something to hold on to.";
const FINAL_HEADING = "That is enough for today.";

/** Splits off the last question so it can sit above the reply box. Cuts the original text, so paragraph breaks survive. */
function splitResponseAndQuestion(response: string): { mainResponse: string; question: string | null } {
  // Start offset of each sentence: the text start, then after every sentence-ending punctuation + whitespace.
  const starts = [0, ...[...response.matchAll(/(?<=[.!?])\s+/g)].map((m) => m.index + m[0].length)];

  let questionStart = -1;
  for (let i = starts.length - 1; i >= 0; i--) {
    const end = i + 1 < starts.length ? starts[i + 1] : response.length;
    if (response.slice(starts[i], end).trim().endsWith("?")) {
      questionStart = starts[i];
      break;
    }
  }

  if (questionStart === -1) {
    return { mainResponse: response, question: null };
  }

  return { mainResponse: response.slice(0, questionStart).trim(), question: response.slice(questionStart).trim() };
}

interface Turn {
  number: number;
  wrote: string;
  reply: string;
}

/**
 * One turn per user/assistant pair. Turn 1 shows the reflection as the person typed it: its stored
 * message is the model-facing version (with the emotion labels), so it comes from entry.thought.
 */
function toTurns(entry: JournalEntry): Turn[] {
  const turns: Turn[] = [{ number: 1, wrote: entry.thought, reply: entry.messages[1]?.content ?? entry.response }];
  for (let i = 2; i + 1 < entry.messages.length; i += 2) {
    turns.push({ number: turns.length + 1, wrote: entry.messages[i].content, reply: entry.messages[i + 1].content });
  }
  return turns;
}

/** The model's text exactly as returned, as plain paragraphs (blank lines separate them). */
function Paragraphs({ text }: { text: string }) {
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

const LABEL = "text-[13px] font-medium leading-[normal] tracking-[0.04em] text-clay";
const CARD = "rounded-[16px] border border-hairline bg-white px-4 py-[14px]";
const REPLY_CARD = "rounded-[20px] border border-hairline bg-white px-5 py-[22px] text-[16.5px] leading-[1.65] text-ink";
const PRIMARY =
  "block h-14 w-full rounded-[28px] bg-maroon text-[17px] font-semibold text-cream transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-[0.55]";
const SECONDARY =
  "block h-[52px] w-full rounded-[26px] border-[1.5px] border-hairline bg-white text-[16px] font-semibold text-maroon transition-colors hover:border-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

/** Section label row; the "n of 4" turn counter sits on the right from turn 2. */
function SectionLabel({ children, counter, className = "" }: { children: string; counter?: string; className?: string }) {
  return (
    <div className={`flex justify-between ${LABEL} ${className}`}>
      <span>{children}</span>
      {counter && <span>{counter}</span>}
    </div>
  );
}

/** An earlier turn, collapsed to a 52px row; tap or press to expand it. */
function TurnRow({ turn, emotions, expanded, onToggle }: { turn: Turn; emotions: string[]; expanded: boolean; onToggle: () => void }) {
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

function EmotionPills({ emotions }: { emotions: string[] }) {
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

/** A small wind line whose dashes drift: the same masked, transform-only strip as the artwork (.art-wind). */
function ThinkingSquiggle({ color, delay }: { color: string; delay: number }) {
  // Mask: the mockup's path at 64x18 (viewBox -2 -9 68 18, scaled to fit). Its dash period of 84
  // along the curve is 77.27 units along x; at this scale, 64/68 px per unit.
  const scale = 64 / 68;
  const period = 77.27 * scale;
  const start = 2 * scale;
  const mask = `url("data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="18" viewBox="-2 -9 68 18"><path d="M0,0 q8,-6 16,0 t16,0 t16,0 t16,0" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round"/></svg>',
  )}") 0 0 / 100% 100% no-repeat`;
  return (
    <div aria-hidden="true" className="relative h-[18px] w-16 overflow-hidden" style={{ mask, WebkitMask: mask }}>
      <div
        className="art-wind absolute inset-y-0"
        style={{ left: start - 3 * period, width: 6 * period, color, opacity: 1, animationDelay: `${delay}s` }}
      />
    </div>
  );
}

export default function ResponseScreen({ entry, isAuthenticated, onSaveReflection, onViewJournal, onGoHome, onEntryUpdate }: Props) {
  const [replyText, setReplyText] = useState("");
  // The reply being sent; set while waiting and kept if the call fails.
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [safetyResponse, setSafetyResponse] = useState("");
  const [openTurn, setOpenTurn] = useState<number | null>(null);
  const replyLabelId = useId();
  const counterId = useId();

  const turns = toTurns(entry);
  const current = turns[turns.length - 1];
  const finished = entry.status === "completed";
  const { mainResponse, question } = splitResponseAndQuestion(current.reply);
  // While waiting (or after a failure) the reply being sent is the next turn, so every turn so far collapses.
  const pending = loading || failed;
  const earlier = pending ? turns : turns.slice(0, -1);
  const shownTurn = pending ? current.number + 1 : current.number;
  const counter = shownTurn >= 2 ? `${shownTurn} of ${MAX_TURNS}` : undefined;
  const remaining = MAX_REPLY_CHARS - replyText.length;
  const canSend = replyText.trim().length > 0 && !loading;

  const sendReply = async () => {
    const text = replyText.trim();
    if (!text || loading || finished) return;
    setLoading(true);
    setFailed(false);
    setPendingText(text);
    setSafetyResponse("");
    setOpenTurn(null);
    window.scrollTo({ top: 0 });

    try {
      const newUserMessage: ConversationMessage = { role: "user", content: text };
      const updatedMessages = [...entry.messages, newUserMessage];
      const currentTurn = entry.turnCount || 0;
      const nextTurn = currentTurn + 1;

      const { data, error: fnError } = await supabase.functions.invoke("sakeena-reflect-v2", {
        body: { entryId: entry.id, messages: updatedMessages, turnNumber: nextTurn },
      });

      if (fnError) throw fnError;

      const responseText = data?.response || data?.choices?.[0]?.message?.content || "Something went wrong. Please try again.";

      if (data?.safetyOnly) {
        setSafetyResponse(responseText);
        return;
      }

      const aiResponse: ConversationMessage = { role: "assistant", content: responseText };
      const finalMessages = [...updatedMessages, aiResponse];
      const newStatus = nextTurn >= MAX_TURNS ? "completed" : "active";

      const updatedEntry: JournalEntry = {
        ...entry,
        messages: finalMessages,
        turnCount: nextTurn,
        status: newStatus,
      };

      onEntryUpdate(updatedEntry);
      setReplyText("");
      window.scrollTo({ top: 0 });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setPendingText(null);
    }
  };

  const save = isAuthenticated ? onViewJournal : onSaveReflection;

  return (
    <div className="animate-fade-in pt-6">
      {/* Narrow enough to stay left of the top-right artwork, as on Home. */}
      <h2 className="font-display max-w-[min(230px,calc(100%-117px))] text-[30px] font-semibold leading-[1.2] text-maroon">
        {finished ? FINAL_HEADING : HEADING}
      </h2>

      {earlier.length > 0 && (
        <div className="mt-[26px] flex flex-col gap-3">
          {earlier.map((turn) => (
            <TurnRow
              key={turn.number}
              turn={turn}
              emotions={entry.emotions}
              expanded={openTurn === turn.number}
              onToggle={() => setOpenTurn(openTurn === turn.number ? null : turn.number)}
            />
          ))}
        </div>
      )}

      {/* What the person wrote this turn (on failure it stays in the box below instead). */}
      {!failed && (
        <>
          <SectionLabel className="mt-[26px]">YOU WROTE</SectionLabel>
          <div className={`mt-2 ${CARD}`}>
            <p className="whitespace-pre-line text-[15px] leading-[1.5] text-clay-deep">{loading ? pendingText : current.wrote}</p>
            {!loading && current.number === 1 && <EmotionPills emotions={entry.emotions} />}
          </div>
        </>
      )}

      <SectionLabel className={failed ? "mt-[26px]" : "mt-7"} counter={counter}>
        A REFLECTION FOR YOU
      </SectionLabel>
      {loading ? (
        <>
          <div role="status" className="mt-2 flex flex-col items-center gap-[10px] rounded-[20px] border border-hairline bg-white px-5 py-7 text-[15.5px] leading-[normal] text-clay-deep">
            <ThinkingSquiggle color="#81D1D0" delay={0} />
            <ThinkingSquiggle color="#E78861" delay={-2} />
            <p className="mt-[6px]">Taking a moment to reflect on this…</p>
          </div>
          {/* The reply is only stored once the response arrives, so leaving now would lose it. */}
          <p className="mt-[14px] text-center text-[13px] leading-[normal] text-clay">Please keep this page open while this finishes.</p>
        </>
      ) : failed ? (
        <div role="alert" className={`mt-2 ${REPLY_CARD} text-center`}>
          <p>That didn't go through. Please try again.</p>
          <button type="button" onClick={sendReply} disabled={!canSend} className={`mt-5 ${PRIMARY}`}>
            Try again
          </button>
        </div>
      ) : (
        <div className={`mt-2 ${REPLY_CARD}`}>
          <Paragraphs text={finished ? current.reply : mainResponse || current.reply} />
        </div>
      )}

      {finished && (
        <>
          <p className="mt-[18px] rounded-[16px] bg-mint px-4 py-[14px] text-[15px] leading-[1.5] text-ink">
            This was today's reflection. Rest well, and come back whenever you need to set something down.
          </p>
          <button type="button" onClick={save} className={`mt-6 ${PRIMARY}`}>
            Save to journal
          </button>
          <button type="button" onClick={onGoHome} className={`mt-3 ${SECONDARY}`}>
            Back to Home
          </button>
        </>
      )}

      {!finished && !loading && (
        <>
          {question ? (
            <p id={replyLabelId} className="mt-8 text-[17px] font-semibold leading-[1.35] text-maroon">
              {question}
            </p>
          ) : (
            <div className="mt-8" />
          )}
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value.slice(0, MAX_REPLY_CHARS))}
            {...(question ? { "aria-labelledby": replyLabelId } : { "aria-label": "Your follow-up" })}
            aria-describedby={counterId}
            placeholder="Write a few words…"
            className={`font-body block h-[120px] w-full resize-none rounded-[20px] border-[1.5px] border-turquoise bg-white px-[18px] py-4 text-[17px] leading-[1.45] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-[#85666A] focus:border-maroon focus:outline-none focus:ring-[3px] focus:ring-maroon/15 ${question ? "mt-3" : ""}`}
          />
          <p id={counterId} className={`mt-2 text-right text-[13px] leading-[normal] ${remaining < 30 ? "text-maroon" : "text-clay"}`}>
            {remaining} {remaining === 1 ? "character" : "characters"} remaining
          </p>
          {!failed && (
            <button type="button" onClick={sendReply} disabled={!canSend} className={`mt-[22px] ${PRIMARY}`}>
              Continue
            </button>
          )}
          <button type="button" onClick={save} className={`${failed ? "mt-[22px]" : "mt-3"} ${SECONDARY}`}>
            Save to journal and finish
          </button>
        </>
      )}

      {safetyResponse && (
        <div
          className="font-body mt-7"
          style={{
            background: '#FFFAF7',
            border: '1px solid #E8D5C8',
            borderLeft: '3px solid #A85E56',
            borderRadius: '12px',
            color: '#2C1810',
            fontSize: '13px',
            lineHeight: '1.75',
            padding: '16px',
          }}
        >
          {safetyResponse}
        </div>
      )}
    </div>
  );
}
