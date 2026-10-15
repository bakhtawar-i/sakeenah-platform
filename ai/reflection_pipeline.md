# Reflection Pipeline

This document describes how a user reflection flows through Sajaa—from the browser UI to the language model and back to persistent storage. It is intended for engineers reviewing the AI system design without reading application source code.

## Overview

Sajaa is a bounded, turn-based reflection experience. Each day, an owner (anonymous session or authenticated user) may start **one** initial reflection. That reflection may include up to **four exchanges** (user message + assistant response per exchange). The pipeline is designed for emotional safety, faith authenticity, and strict data isolation.

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────┐     ┌──────────────┐
│  Frontend   │────▶│  Edge Function       │────▶│  Gemini API │────▶│  Postgres    │
│  (React)    │◀────│  sakeena-reflect-v2  │◀────│  (LLM)      │     │  (via RPC)   │
└─────────────┘     └──────────────────────┘     └─────────────┘     └──────────────┘
       │                       │
       │                       ├── Crisis screening (deterministic, pre-LLM)
       │                       ├── Daily limit check (turn 1 only)
       │                       └── Memory context injection (authenticated, turn 1 only)
       │
       └── x-session-id header on every request
```

## Stage 1: User Input (Frontend)

**Entry point:** `HomeScreen` for the initial reflection; `ResponseScreen` for follow-up exchanges.

| Turn | Screen | User provides |
|------|--------|---------------|
| 1 | `HomeScreen` | Journal text (≤ 250 chars), optional emotion labels |
| 2–4 | `ResponseScreen` | Short free-text reply to the assistant |

The frontend packages each request as:

- `messages` — full conversation history in `{ role, content }` form
- `turnNumber` — integer 1–4
- `entryId` — required for turns 2–4; omitted on turn 1
- `entryText` — required on turn 1 only
- `emotionLabels` — string array on turn 1 only

Requests are sent via `supabase.functions.invoke("sakeena-reflect-v2", { body })`. The Supabase client automatically attaches the `Authorization` header (when signed in) and the custom `x-session-id` header from browser localStorage.

## Stage 2: Edge Function Gateway

**Endpoint:** `supabase/functions/sakeena-reflect-v2/index.ts`

The Edge Function acts as the sole server-side entry point for AI generation. It does not expose the LLM API key to the client.

### Request validation

- `x-session-id` must be present (anonymous or authenticated session identity)
- `turnNumber` must be an integer between 1 and 4
- Turn 1 requires `entryText`; turns 2–4 require `entryId`
- `emotionLabels` must be an array of strings when provided

### Crisis screening (pre-LLM)

Before any model call, the latest user message is screened with deterministic pattern matching for self-harm, suicidal ideation, and related crisis language. When matched:

1. **Gemini is not called.**
2. A standardized crisis-support response is returned (Naseeha helpline: 1-866-627-3342).
3. The exchange is still persisted through `persist_reflection_exchange` when possible.

Immediate-danger phrasing receives an expanded response that also directs the user to local emergency services.

This layer is independent of model behavior and cannot be overridden by prompt engineering.

### Daily limit enforcement (turn 1 only)

On the initial reflection, the function calls `can_start_daily_reflection(p_session_id)`. This RPC checks `usage_log` for an existing reflection by the same owner (authenticated `user_id` or anonymous `session_id`) within the current UTC day.

If the limit is exceeded, the function returns HTTP 429 with a user-facing message—no LLM call is made.

### System prompt selection (turn-dependent)

The function selects one of three prompt regimes based on `turnNumber`:

| Turn | Prompt regime | Purpose |
|------|---------------|---------|
| 1 | Structured reflection | Full faith-grounded response (100–150 words, Islamic references, emotion-aware) |
| 2–3 | Conversational | Brief, warm follow-up (≤ 50 words; no new Quran/Hadith) |
| 4 | Closing | Final acknowledgment (≤ 60 words; no questions, no new references) |

See `ai/prompts/` for placeholder references to each prompt artifact.

### Memory injection (authenticated, turn 1 only)

For signed-in users on turn 1, the function calls `get_recent_completed_reflections(p_limit := 3)` and appends bounded historical context to the system prompt. Only reflection date, entry text (truncated to 500 chars), and emotion labels are included—never prior AI responses or conversation turns.

Anonymous users receive no cross-session memory.

## Stage 3: LLM Generation

**Provider:** Google Gemini  
**Model:** `gemini-2.5-flash-lite`  
**Interface:** `generateContent` with `systemInstruction` + `contents`

The conversation history is converted to Gemini's `user` / `model` role format. The system instruction carries the turn-specific prompt plus optional memory context.

### Prompt constraints and response shaping

Turn 1 responses are shaped by explicit structural rules in the system prompt:

1. Acknowledge the user's words specifically
2. Introduce a relevant attribute of Allah matched to emotional state
3. Offer a tawakkul-based reframing
4. Include one authentic Quranic verse, Hadith, or du'a (Arabic + translation)
5. End with a reflection question or single-line encouragement

Additional hard constraints:

- 100–150 word cap on turn 1
- No clinical or therapeutic claims
- No fabricated Islamic references
- Emotion labels guide attribute selection; content is used when labels are absent
- Off-topic requests receive a fixed redirect message (also enforced in prompt)

Turns 2–4 use progressively tighter word limits and forbid re-introducing scholarly content, keeping the conversation human and bounded.

## Stage 4: Persistence (Database RPC)

Every successful or crisis-routed exchange is written through a single transactional RPC:

**`persist_reflection_exchange(...)`**

This RPC atomically:

- Creates or updates the `entries` row (reflection text, emotion labels, status, turn count)
- Inserts paired rows in `conversation_turns` (user + assistant sharing the same `turn_number`)
- Records daily usage in `usage_log` on turn 1
- Marks the entry `completed` when turn 4 finishes

The frontend never writes directly to `entries`, `conversation_turns`, or `usage_log`. All persistence is server-side inside RPCs, preserving RLS and session isolation.

### Return payload

```json
{
  "response": "<assistant text>",
  "entryId": "<uuid>"
}
```

Crisis-only responses may include `"safetyOnly": true` when persistence partially fails.

## Stage 5: Frontend State Update

- **Turn 1:** `HomeScreen` builds a local `JournalEntry` from the response and navigates to `ResponseScreen`.
- **Turns 2–4:** `ResponseScreen` appends messages locally and sets `status: "completed"` after turn 4.
- **Crisis path:** A safety banner is shown; the user is not advanced into a normal conversation flow.

Journal history for returning users is loaded separately via `get_session_entries(p_session_id)` in `JournalScreen`—not from the reflection pipeline itself.

## Bounded Conversation Design

| Constraint | Enforcement layer |
|------------|-------------------|
| 1 reflection per UTC day | `can_start_daily_reflection` + `usage_log` |
| Max 4 exchanges | Frontend UI + Edge Function `turnNumber` validation |
| Paired turn numbering | `persist_reflection_exchange` RPC |
| Status `"completed"` (not `"complete"`) | RPC on final turn |
| No unbounded chat | Distinct prompt regimes per turn; turn 4 is closing-only |

This design intentionally limits context window growth, model cost, and emotional over-reliance on open-ended AI chat.

## Related Components

| Component | Location |
|-----------|----------|
| Production reflection endpoint | `supabase/functions/sakeena-reflect-v2/` |
| Legacy v1 endpoint (compatibility) | `supabase/functions/sakeena-reflect/` |
| Daily limit RPC | `can_start_daily_reflection` |
| Persistence RPC | `persist_reflection_exchange` |
| Memory retrieval RPC | `get_recent_completed_reflections` |
| Initial reflection UI | `src/components/HomeScreen.tsx` |
| Follow-up conversation UI | `src/components/ResponseScreen.tsx` |

## Design Principles

1. **Safety before generation** — Crisis screening runs deterministically before the LLM.
2. **Server-owned persistence** — The client never mutates journal tables directly.
3. **Bounded context** — Four turns, three prior reflections max, truncated entry text.
4. **Faith authenticity** — Structured prompts require authentic sources; fabrication is explicitly forbidden.
5. **Subtle memory** — Historical context is injected only when relevant; the model is instructed not to announce recall.
