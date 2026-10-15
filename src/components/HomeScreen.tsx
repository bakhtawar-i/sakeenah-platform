import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type JournalEntry } from "@/lib/storage";

const EMOTION_ROWS = [
  ["Anxious", "Worried", "Overwhelmed", "Burnt Out"],
  ["Stressed", "Drained", "Sad", "Lonely"],
  ["Angry", "Guilty", "Lost", "Confused"],
  ["Hopeful", "Grateful", "Peaceful", "Content"],
];

const MAX_CHARS = 300;

interface Props {
  onResponse: (entry: JournalEntry) => void;
}

async function getRateLimitMessage(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object" || !("context" in error)) return null;

  const { context } = error as { context?: unknown };
  if (!(context instanceof Response) || context.status !== 429) return null;

  try {
    const body = await context.clone().json() as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

export default function HomeScreen({ onResponse }: Props) {
  const [thought, setThought] = useState("");
  const [emotions, setEmotions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [safetyResponse, setSafetyResponse] = useState("");

  const toggleEmotion = (e: string) => {
    setEmotions((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  };

  const submit = async () => {
    if (!thought.trim() || loading) return;
    setLoading(true);
    setError("");
    setSafetyResponse("");

    try {
      const userMessage = `Journal entry: ${thought.trim()}\n\nEmotion labels: ${emotions.length ? emotions.join(", ") : "None provided"}`;

      const initialMessages = [{ role: "user" as const, content: userMessage }];

      const { data, error: fnError } = await supabase.functions.invoke("sakeena-reflect-v2", {
        body: {
          messages: initialMessages,
          turnNumber: 1,
          entryText: thought.trim(),
          emotionLabels: emotions,
        },
      });

      if (fnError) {
        const rateLimitMessage = await getRateLimitMessage(fnError);
        if (rateLimitMessage) {
          setError(rateLimitMessage);
          return;
        }

        throw fnError;
      }

      const responseText = data?.response || data?.choices?.[0]?.message?.content || "Something went wrong. Please try again.";

      if (data?.safetyOnly) {
        setSafetyResponse(responseText);
        return;
      }

      if (!data?.entryId) throw new Error("Missing entry ID");

      const messagesWithResponse = [
        ...initialMessages,
        { role: "assistant" as const, content: responseText },
      ];

      const entry: JournalEntry = {
        id: data.entryId,
        thought: thought.trim(),
        emotions,
        response: responseText,
        messages: messagesWithResponse,
        turnCount: 1,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      onResponse(entry);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const remaining = MAX_CHARS - thought.length;
  const canSubmit = thought.trim().length > 0 && !loading;

  return (
    <div className="animate-fade-in pt-6">

      {/* Narrow enough to stay left of the top-right artwork (which starts 129px from the column's right edge). */}
      <h2 id="home-heading" className="font-display max-w-[min(230px,calc(100%-117px))] text-[30px] font-semibold leading-[1.2] text-maroon">
        What's on your mind?
      </h2>

      <textarea
        value={thought}
        onChange={(e) => e.target.value.length <= MAX_CHARS && setThought(e.target.value)}
        aria-labelledby="home-heading"
        aria-describedby="home-char-count"
        placeholder="What is on your heart today..."
        rows={5}
        className="font-body mt-7 block h-[190px] w-full resize-none rounded-[20px] border-[1.5px] border-turquoise bg-white p-[18px] text-[17px] leading-[1.45] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-[#85666A] focus:border-maroon focus:outline-none focus:ring-[3px] focus:ring-maroon/15"
      />
      <p id="home-char-count" className={`mt-2 text-right text-[13px] ${remaining < 30 ? "text-maroon" : "text-clay"}`}>
        {remaining} {remaining === 1 ? "character" : "characters"} remaining
      </p>

      <p id="home-feelings-label" className="font-body mt-[26px] text-[15px] font-medium text-clay-deep">
        What feels closest right now?
      </p>

      <div role="group" aria-labelledby="home-feelings-label" className="mt-3 flex flex-wrap justify-start gap-[10px]">
        {EMOTION_ROWS.map((row) =>
          row.map((e) => {
            const isActive = emotions.includes(e);
            return (
              <button
                key={e}
                type="button"
                onClick={() => toggleEmotion(e)}
                aria-pressed={isActive}
                className={`chip flex h-10 items-center whitespace-nowrap border-[1.5px] px-4 text-[14px] font-normal ${isActive ? "chip-active" : ""}`}
              >
                {e}
              </button>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-11 h-14 w-full rounded-[28px] bg-maroon text-[17px] font-semibold text-cream transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-[0.55]"
      >
        {loading ? (
          <span className="animate-pulse-soft">Reflecting...</span>
        ) : (
          "Reflect"
        )}
      </button>

      {error && <p className="mt-2 text-center text-xs text-maroon">{error}</p>}
      {safetyResponse && (
        <div className="font-body mt-4 rounded-xl border border-l-[3px] border-hairline border-l-maroon bg-white p-4 text-[13px] leading-[1.75] text-ink">
          {safetyResponse}
        </div>
      )}

    </div>
  );
}
