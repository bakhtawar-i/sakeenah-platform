# System Design

High-level architecture for **Sajaa** — a private, faith-native reflection web application. This document is written for engineers, reviewers, and ML/AI portfolio readers who need to understand how the system fits together without reading the full codebase.

## Product Summary

Sajaa helps Muslims write one daily reflection, optionally tag emotions, receive an AI response grounded in tawakkul (trust in Allah), and continue a short guided conversation (up to four exchanges). The product prioritizes emotional safety, Islamic authenticity, privacy, and retention over feature breadth.

**Deployment:** React SPA on Vercel · Supabase (Auth, Postgres, Edge Functions) · Gemini via server-side API calls

---

## Architecture Diagram

```
                         ┌─────────────────────────────────────┐
                         │           Vercel (CDN)              │
                         │   React 18 + TypeScript + Vite      │
                         └─────────────────┬───────────────────┘
                                           │ HTTPS
                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            Supabase Platform                              │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │  Auth       │  │  Edge Functions  │  │  Postgres + RLS             │  │
│  │  (email/pw) │  │                  │  │                             │  │
│  │             │  │  sakeena-       │  │  entries                    │  │
│  │             │  │  reflect-v2    │──┼─▶│  conversation_turns         │  │
│  │             │  │                  │  │  usage_log                  │  │
│  │             │  │  claim-anonymous │  │  profiles                   │  │
│  │             │  │  -session        │  │                             │  │
│  │             │  │                  │  │  RPCs (transactional)       │  │
│  └─────────────┘  └────────┬─────────┘  └─────────────────────────────┘  │
│                            │                                              │
└────────────────────────────┼──────────────────────────────────────────────┘
                             │ API key (server-only)
                             ▼
                    ┌─────────────────┐
                    │  Google Gemini  │
                    │  2.5 Flash Lite │
                    └─────────────────┘
```

---

## Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | React 18, TypeScript, Vite | SPA; mobile-first, max-width 420px |
| Styling | Tailwind CSS, shadcn/ui | Cormorant Garamond + Lora fonts |
| Auth | Supabase Auth | Email/password with verification |
| Database | Supabase Postgres | RLS on all user data |
| Server logic | Supabase Edge Functions (Deno) | LLM orchestration, no client API keys |
| AI | Gemini `gemini-2.5-flash-lite` | Invoked only from Edge Functions |
| CI/CD | GitHub → Vercel | Preview on branches; production from `main` |

---

## Core Data Model

### Tables

| Table | Purpose |
|-------|---------|
| `entries` | Daily reflection records (text, emotions, AI response, messages, status) |
| `conversation_turns` | Normalized user/assistant message pairs per turn |
| `usage_log` | Enforces one initial reflection per owner per UTC day |
| `profiles` | Authenticated user profile state |

### Ownership model

Every entry belongs to exactly one owner:

- **Anonymous:** `session_id` (browser localStorage UUID)
- **Authenticated:** `user_id` (Supabase Auth UID)

Anonymous data is claimed atomically on signup via `claim_anonymous_session`.

### Key RPCs

| RPC | Called by | Purpose |
|-----|-----------|---------|
| `set_request_session(session_id)` | Other RPCs | Injects session context for RLS |
| `can_start_daily_reflection(p_session_id)` | `sakeena-reflect-v2` | Pre-flight daily limit check |
| `persist_reflection_exchange(...)` | `sakeena-reflect-v2` | Transactional write for each exchange |
| `get_session_entries(p_session_id)` | `JournalScreen` | Read journal history |
| `get_recent_completed_reflections(p_limit)` | `sakeena-reflect-v2` | Memory v1 context (auth only) |
| `claim_anonymous_session(p_session_id)` | `claim-anonymous-session` | Transfer anon data to user |

**Invariant:** The frontend never inserts or updates `entries`, `conversation_turns`, or `usage_log` directly. All writes go through `persist_reflection_exchange`.

---

## Core Flows

### 1. Reflection Flow

The primary AI pipeline. Detailed documentation: [`ai/reflection_pipeline.md`](../ai/reflection_pipeline.md).

```
User writes reflection (HomeScreen)
        │
        ▼
sakeena-reflect-v2  { turnNumber: 1, entryText, emotionLabels, messages }
        │
        ├── Crisis screen latest user message ──▶ skip LLM if matched
        ├── can_start_daily_reflection ──▶ 429 if already reflected today
        ├── get_recent_completed_reflections (if authenticated) ──▶ memory context
        ├── Gemini generateContent
        └── persist_reflection_exchange ──▶ { response, entryId }
        │
        ▼
ResponseScreen — up to 3 more exchanges (turns 2–4)
        │
        ▼
Entry status → "completed" after turn 4
```

**Bounded conversation:** 4 exchanges max. Turn-specific system prompts shape response length and content (structured → conversational → closing).

### 2. Authentication & Session Claim Flow

```
Anonymous user completes reflection
        │
        ▼
SignUpPrompt → email/password signup
        │
        ▼
Email verification → sign in
        │
        ▼
claim-anonymous-session  { x-session-id, Authorization }
        │
        ▼
claim_anonymous_session(p_session_id)  ──▶ reassign entries, usage_log, turns
        │
        ▼
User sees journal history; Memory v1 enabled on next reflection
```

Anonymous users receive a `sakeenah_session_id` in localStorage (`src/lib/session.ts`). The Supabase client sends this as `x-session-id` on every Edge Function call.

### 3. Journal Retrieval Flow

```
Authenticated or anonymous user opens JournalScreen
        │
        ▼
get_session_entries(p_session_id)
        │
        ▼
RLS-scoped list of entries (reflection text, emotions, messages, dates)
        │
        ▼
Rendered as read-only history cards
```

Journal reads do not invoke the LLM. They are pure database reads through an RPC.

---

## Edge Functions

| Function | Status | Role |
|----------|--------|------|
| `sakeena-reflect-v2` | **Production** | Reflection generation, crisis screening, memory injection, persistence |
| `claim-anonymous-session` | **Production** | Post-auth session claim |
| `sakeena-reflect` | Legacy | v1 compatibility; no new features |

### `sakeena-reflect-v2` responsibilities

1. Validate request shape and session header
2. Run deterministic crisis screening before LLM calls
3. Enforce daily reflection limits
4. Select turn-appropriate system prompt
5. Inject Memory v1 context for authenticated turn-1 requests
6. Call Gemini with server-held API key
7. Persist via `persist_reflection_exchange`
8. Return `{ response, entryId }` to the client

---

## Security & Privacy

| Concern | Mitigation |
|---------|------------|
| Cross-user data access | Postgres RLS + session-scoped RPCs |
| API key exposure | Gemini key only in Edge Function env |
| Prompt injection via journal | Historical entries labeled untrusted in prompts |
| Crisis situations | Deterministic pre-LLM screening; standardized helpline response |
| Direct table writes | Frontend blocked; transactional RPCs only |
| Anonymous isolation | `session_id` in JWT claims via `set_request_session` |

Privacy copy (technically accurate):

> Your reflections are stored privately and securely. They are used only to generate your responses and are never sold or shared for advertising.

---

## AI System Documentation

For deeper AI/ML engineering detail, see:

| Document | Contents |
|----------|----------|
| [`ai/reflection_pipeline.md`](../ai/reflection_pipeline.md) | End-to-end reflection flow, prompt regimes, safety |
| [`ai/memory_design.md`](../ai/memory_design.md) | Session memory, Memory v1, future longitudinal plans |
| [`ai/prompts/`](../ai/prompts/) | Prompt artifact references |

---

## Frontend Structure

| Path | Responsibility |
|------|----------------|
| `src/pages/Index.tsx` | Root SPA state machine (onboarding, auth, screens) |
| `src/components/HomeScreen.tsx` | Daily reflection input + turn 1 API call |
| `src/components/ResponseScreen.tsx` | AI response display + turns 2–4 |
| `src/components/JournalScreen.tsx` | Journal history via `get_session_entries` |
| `src/components/Onboarding.tsx` | Trust and privacy introduction |
| `src/integrations/supabase/client.ts` | Browser Supabase client |
| `src/lib/session.ts` | Anonymous session ID |
| `src/lib/auth.ts` | Auth helpers |

---

## Product Invariants

These rules are enforced across frontend, Edge Functions, and database layers:

- One initial reflection per owner per UTC day
- Maximum four user/assistant exchanges per reflection
- Entry status value `"completed"` (never `"complete"`)
- User and assistant messages in one exchange share the same `turn_number`
- No fabricated Quranic verses or Hadith
- No claims of being a therapist or medical professional
- Crisis language → standardized support response, not standard reflection
- No gamification (streaks, leaderboards, punitive mechanics)

---

## Deployment Topology

```
Developer ──▶ feature branch ──▶ GitHub PR ──▶ Vercel Preview
                                    │
                                    ▼ merge to main
                              Vercel Production

Supabase migrations and Edge Functions are deployed separately from the Vercel frontend.
```

---

## Future Architecture (Deferred)

Documented for context; not in active development unless retention evidence supports prioritization:

- Weekly pattern detection and insight summaries
- Ask Sajaa over recent entries
- Active-reflection resume support
- Soft paywall / payments
- Provider migration (e.g., Anthropic) — deferred
- Embeddings / vector retrieval — explicitly out of scope for Memory v1

See `CLAUDE.md` for the canonical product roadmap and `ai/memory_design.md` for the memory evolution plan.
