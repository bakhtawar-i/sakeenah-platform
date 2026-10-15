import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type JournalEntry, type ConversationMessage } from "@/lib/storage";
import ReactMarkdown from "react-markdown";

interface Props {
  entry: JournalEntry;
  isAuthenticated: boolean;
  onSaveReflection: () => void;
  onViewJournal: () => void;
  onEntryUpdate: (entry: JournalEntry) => void;
}

function splitResponseAndQuestion(response: string): { mainResponse: string; question: string | null } {
  const sentences = response.split(/(?<=[.!?])\s+/);

  let questionIndex = -1;
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (sentences[i].trim().endsWith('?')) {
      questionIndex = i;
      break;
    }
  }

  if (questionIndex === -1) {
    return { mainResponse: response, question: null };
  }

  const mainResponse = sentences.slice(0, questionIndex).join(' ').trim();
  const question = sentences.slice(questionIndex).join(' ').trim();

  return { mainResponse, question };
}

export default function ResponseScreen({ entry, isAuthenticated, onSaveReflection, onViewJournal, onEntryUpdate }: Props) {
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [safetyResponse, setSafetyResponse] = useState("");

  const { mainResponse, question } = splitResponseAndQuestion(entry.response);

  const followUpMessages = entry.messages?.slice(2) || [];

  const exchangesRemaining = 4 - entry.turnCount;

  const sendReply = async () => {
    if (!replyText.trim() || loading || entry.status === "completed") return;
    setLoading(true);
    setError("");
    setSafetyResponse("");

    try {
      const newUserMessage: ConversationMessage = { role: "user", content: replyText.trim() };
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
      const newStatus = nextTurn >= 4 ? "completed" : "active";

      const updatedEntry: JournalEntry = {
        ...entry,
        messages: finalMessages,
        turnCount: nextTurn,
        status: newStatus,
      };

      onEntryUpdate(updatedEntry);
      setReplyText("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px 20px 0 20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 1. USER JOURNAL ENTRY - Right-aligned chat bubble */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div
            style={{
              maxWidth: '80%',
              background: '#A85E56',
              borderRadius: '18px 18px 4px 18px',
              padding: '14px 18px',
            }}
          >
            {entry.emotions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-end', marginBottom: '10px' }}>
                {entry.emotions.map((e) => (
                  <span
                    key={e}
                    className="font-body"
                    style={{
                      background: 'rgba(255, 255, 255, 0.22)',
                      color: 'white',
                      fontSize: '11px',
                      padding: '3px 10px',
                      borderRadius: '100px',
                    }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            )}
            <p
              className="font-body"
              style={{
                fontSize: '13.5px',
                color: '#FFFFFF',
                lineHeight: '1.7',
                margin: 0,
                textAlign: 'right',
              }}
            >
              {entry.thought}
            </p>
          </div>
        </div>

        {/* 2. INITIAL AI RESPONSE - Full width card */}
        <div
          style={{
            background: '#FFFFFF',
            border: '0.5px solid #E8D5C8',
            borderRadius: '12px',
            padding: '16px 18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <div
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: '#C17C74',
              }}
            />
            <span
              className="font-body"
              style={{
                fontSize: '10px',
                color: 'rgba(44, 24, 16, 0.45)',
              }}
            >
              A reflection for you
            </span>
          </div>

          <div
            style={{
              borderLeft: '1.5px solid #E2CFC5',
              paddingLeft: '14px',
            }}
          >
            <div
              className="prose prose-sm max-w-none font-body"
              style={{
                fontSize: '13px',
                color: '#2C1810',
                lineHeight: '1.75',
              }}
            >
              <ReactMarkdown>{mainResponse || entry.response}</ReactMarkdown>
            </div>
          </div>
        </div>

        {/* 3. SAJAA ASKS - Left-aligned chat bubble (only for turn 1 question) */}
        {question && entry.turnCount === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span
              className="font-body"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: '#C17C74',
                marginBottom: '6px',
              }}
            >
              Sajaa asks
            </span>
            <div
              style={{
                maxWidth: '80%',
                background: '#C17C74',
                borderRadius: '18px 18px 18px 4px',
                padding: '14px 18px',
              }}
            >
              <p
                className="font-body"
                style={{
                  fontSize: '13.5px',
                  color: '#FFFFFF',
                  lineHeight: '1.7',
                  margin: 0,
                }}
              >
                {question}
              </p>
            </div>
          </div>
        )}

        {/* 4. FOLLOW-UP CONVERSATION THREAD */}
        {followUpMessages.map((msg, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.role === 'assistant' && (
              <span
                className="font-body"
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#C17C74',
                  marginBottom: '6px',
                }}
              >
                Sajaa
              </span>
            )}
            <div
              style={{
                maxWidth: '80%',
                background: msg.role === 'user' ? '#A85E56' : '#C17C74',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '14px 18px',
              }}
            >
              <p
                className="font-body"
                style={{
                  fontSize: '13.5px',
                  color: '#FFFFFF',
                  lineHeight: '1.7',
                  margin: 0,
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                }}
              >
                {msg.content}
              </p>
            </div>
          </div>
        ))}

        {/* 5. REPLY INPUT AREA (when conversation is active) */}
        {entry.status === "active" && (
          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#FFFFFF',
                border: '0.5px solid #E2CFC5',
                borderRadius: '100px',
                padding: '10px 16px',
              }}
            >
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply..."
                disabled={loading}
                className="font-body"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '13px',
                  color: '#2C1810',
                  fontStyle: 'italic',
                }}
              />
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || loading}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: replyText.trim() && !loading ? '#2C1810' : 'rgba(44, 24, 16, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: replyText.trim() && !loading ? 'pointer' : 'default',
                  transition: 'background 0.2s ease',
                }}
              >
                {loading ? (
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      border: '2px solid rgba(253, 246, 240, 0.3)',
                      borderTopColor: '#FDF6F0',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={replyText.trim() ? '#FDF6F0' : 'rgba(44, 24, 16, 0.4)'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
            <p
              className="font-body text-center"
              style={{
                fontSize: '10px',
                color: 'rgba(44, 24, 16, 0.45)',
                marginTop: '10px',
              }}
            >
              {exchangesRemaining} {exchangesRemaining === 1 ? 'exchange' : 'exchanges'} remaining
            </p>
            {error && (
              <p className="text-xs mt-2 text-center" style={{ color: '#A85E56' }}>{error}</p>
            )}
            {safetyResponse && (
              <div
                className="font-body mt-4"
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
        )}

        {/* 6. COMPLETION MESSAGE (when conversation is complete) */}
        {entry.status === "completed" && (
          <p
            className="font-body text-center"
            style={{
              fontSize: '13px',
              fontStyle: 'italic',
              color: 'rgba(44, 24, 16, 0.6)',
              marginTop: '16px',
              marginBottom: '8px',
            }}
          >
            This reflection is complete. Until tomorrow — fi amanillah.
          </p>
        )}

        {/* 7. COMPLETED-STATE ACTIONS */}
        {entry.status === "completed" && (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={isAuthenticated ? onViewJournal : onSaveReflection}
              className="w-full py-3 font-body font-medium transition-all text-center"
              style={{
                background: '#2C1810',
                color: '#FDF6F0',
                borderRadius: '100px',
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isAuthenticated ? "View journal" : "Save your reflection"}
            </button>
            {!isAuthenticated && (
              <button
                onClick={onViewJournal}
                className="w-full font-body transition-colors text-center"
                style={{
                  color: 'rgba(44, 24, 16, 0.45)',
                  fontSize: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                View journal
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
