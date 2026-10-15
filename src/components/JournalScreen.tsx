import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";

interface EntryRow {
  id: string;
  session_id: string;
  entry_text: string;
  emotion_labels: string[];
  ai_response: string;
  created_at: string;
}

interface Props {
  onNavigateHome?: () => void;
}

export default function JournalScreen({ onNavigateHome }: Props) {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="animate-fade-in text-center py-12 pt-[36px]">
        <p className="text-sm" style={{ color: 'rgba(44, 24, 16, 0.45)' }}>Loading entries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="animate-fade-in"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 200px)',
          textAlign: 'center',
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: '24px',
            fontWeight: 300,
            fontStyle: 'italic',
            color: '#2C1810',
          }}
        >
          We could not load your reflections right now.
        </h2>
        <p
          className="font-body"
          style={{
            fontSize: '13px',
            color: 'rgba(44, 24, 16, 0.45)',
            marginTop: '8px',
          }}
        >
          Please try again.
        </p>
        <button
          onClick={() => void fetchEntries()}
          className="font-body"
          style={{
            background: '#2C1810',
            color: '#FDF6F0',
            fontSize: '13px',
            padding: '12px 28px',
            borderRadius: '100px',
            marginTop: '24px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        className="animate-fade-in"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 200px)',
          textAlign: 'center',
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: '24px',
            fontWeight: 300,
            fontStyle: 'italic',
            color: '#2C1810',
          }}
        >
          Your reflections will appear here
        </h2>
        <p
          className="font-body"
          style={{
            fontSize: '13px',
            color: 'rgba(44, 24, 16, 0.45)',
            marginTop: '8px',
          }}
        >
          Begin by sharing what is on your heart.
        </p>
        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            className="font-body"
            style={{
              background: '#2C1810',
              color: '#FDF6F0',
              fontSize: '13px',
              padding: '12px 28px',
              borderRadius: '100px',
              marginTop: '24px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Write your first reflection
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-3 pt-[36px]">
      {entries.map((entry) => {
        const isOpen = expanded === entry.id;
        return (
          <div
            key={entry.id}
            className="overflow-hidden"
            style={{
              background: '#FFFAF7',
              border: '1px solid #F0E0D4',
              borderRadius: '12px',
              boxShadow: '0 2px 14px rgba(44, 24, 16, 0.05)',
            }}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : entry.id)}
              className="w-full text-left flex items-start justify-between gap-3"
              style={{ padding: '20px' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs mb-1" style={{ color: 'rgba(44, 24, 16, 0.45)' }}>
                  {format(new Date(entry.created_at), "MMM d, yyyy · h:mm a")}
                </p>
                {entry.emotion_labels && entry.emotion_labels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {entry.emotion_labels.map((e) => (
                      <span key={e} className="chip chip-active text-[10px] px-2 py-0.5">{e}</span>
                    ))}
                  </div>
                )}
                <p className="text-sm truncate" style={{ color: '#2C1810' }}>
                  {entry.entry_text.slice(0, 80)}{entry.entry_text.length > 80 ? "..." : ""}
                </p>
              </div>
              {isOpen
                ? <ChevronUp className="w-4 h-4 shrink-0 mt-1" style={{ color: 'rgba(44, 24, 16, 0.45)' }} />
                : <ChevronDown className="w-4 h-4 shrink-0 mt-1" style={{ color: 'rgba(44, 24, 16, 0.45)' }} />
              }
            </button>
            {isOpen && (
              <div style={{ borderTop: '1px solid #F0E0D4', padding: '20px', paddingTop: '12px' }}>
                <p className="text-xs mb-3 leading-relaxed" style={{ color: 'rgba(44, 24, 16, 0.45)' }}>{entry.entry_text}</p>
                <div
                  className="prose prose-sm max-w-none leading-relaxed font-body"
                  style={{
                    color: '#2C1810',
                    borderLeft: '1.5px solid #E2CFC5',
                    paddingLeft: '14px',
                    fontSize: '13px',
                    lineHeight: '1.75',
                  }}
                >
                  <ReactMarkdown>{entry.ai_response}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
