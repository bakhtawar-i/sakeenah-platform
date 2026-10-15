# Sajaa - Project Intelligence

## Product

Sajaa is a private, faith-native reflection web app for Muslims of all ages and genders. Users write one reflection per day, optionally select emotions, receive an AI-generated response rooted in tawakkul, and continue a short guided conversation.

This is an emotionally sensitive product. Every change should prioritize user trust, privacy, emotional safety, authenticity of Islamic references, and retention.

Sajaa is a responsive web app deployed on Vercel. It is not currently a native mobile app or PWA.

## Current Stack

- Frontend: React 18, TypeScript, Vite
- Styling: Tailwind CSS and shadcn/ui
- Backend: Supabase Auth, Postgres, RLS, RPCs, and Edge Functions
- AI provider: Gemini through Supabase Edge Functions
- Deployment: GitHub branches, Vercel Preview deployments, and Vercel production from `main`
- Fonts: Readex Pro for all Latin text; Aref Ruqaa for the Arabic wordmark only

Do not migrate AI providers unless explicitly requested. Anthropic migration is deferred until retention or paid usage justifies it.

## Current Architecture

### Frontend

- `src/pages/Index.tsx`: root SPA screen state and auth transition handling
- `src/components/HomeScreen.tsx`: daily reflection input and emotion selection
- `src/components/ResponseScreen.tsx`: AI response and follow-up conversation
- `src/components/JournalScreen.tsx`: journal history read through an RPC
- `src/components/Welcome.tsx`: v3 Welcome screen (wordmark, tagline, privacy footer); shown once per browser via `sajaa_onboarding_v3` and reopened from the header wordmark or the "About Sajaa" footer link
- `src/lib/session.ts`: anonymous browser session ID stored as `sakeenah_session_id`
- `src/integrations/supabase/client.ts`: Supabase browser client
- `src/integrations/supabase/types.ts`: generated Supabase types

### Supabase Edge Functions

- `sakeena-reflect-v2`: production reflection endpoint
  - Reads `x-session-id`
  - Uses the incoming authorization header
  - Calls Gemini
  - Persists exchanges through `persist_reflection_exchange`
  - Returns `response` and `entryId`
- `claim-anonymous-session`: authenticated account-claim endpoint
  - Requires a valid authenticated user
  - Claims the exact anonymous browser session
  - Calls `claim_anonymous_session`
- `sakeena-reflect`: legacy v1 compatibility endpoint
  - Keep active temporarily
  - Do not add new features to v1
  - Retire only after logs confirm it is no longer needed

### Database

Current tables:

- `entries`
  - Stores the reflection, AI response, conversation messages, status, turn count, completion timestamp, and either anonymous `session_id` or authenticated `user_id`
- `conversation_turns`
  - Stores each user and assistant message
  - A user and assistant message in the same exchange share one `turn_number`
- `usage_log`
  - Enforces one initial reflection per owner per UTC day
- `profiles`
  - Stores authenticated profile state

Current RPCs:

- `set_request_session(session_id text)`
- `can_start_daily_reflection(p_session_id text)`
- `get_session_entries(p_session_id text)`
- `get_recent_completed_reflections(p_limit integer)`
- `persist_reflection_exchange(...)`
- `claim_anonymous_session(p_session_id text)`

Reflection persistence belongs inside transactional RPCs. Do not add direct frontend inserts or updates to `entries`, `conversation_turns`, or `usage_log`.

## Auth And Session Behavior

- Anonymous users receive a browser session ID stored in localStorage.
- Anonymous users can complete one full daily reflection before signup.
- A reflection contains four exchanges maximum.
- After an anonymous reflection completes, the app prompts the user to create an account.
- Auth uses Supabase email and password with email verification.
- After verified sign-in, `claim-anonymous-session` atomically claims anonymous `entries`, `usage_log`, and `conversation_turns`.
- Returning authenticated users can view their journal and remain subject to the daily limit.

## Product Rules - Never Violate

- Allow one initial reflection per owner per UTC day.
- Cap the conversation at four user/assistant exchanges.
- Use status value `"completed"`, never `"complete"`.
- Both messages in one exchange must share the same `turn_number`.
- Never fabricate Quranic verses or Hadith.
- Never claim that Sajaa is a therapist, counsellor, or medical professional.
- Crisis-related language must return a crisis-support response instead of a standard reflection.
- Keep journal entries private. Preserve strict RLS and session isolation.
- Do not add points, punitive streaks, leaderboards, or anxiety-inducing gamification.
- Privacy copy must be technically accurate. Do not claim that nobody can read stored reflections.

Recommended privacy wording:

> Your reflections are stored privately and securely. They are used only to generate your responses and are never sold or shared for advertising.

## Design System

`DESIGN.md` is the source of truth for the v3 visual design: palette, type, interface rules, artwork, motion and screen content. Read it before any UI change.

Implementation notes:

- Palette tokens live in `src/index.css` (`--ink`, `--cream`, `--maroon`, `--clay`, `--clay-deep`, `--turquoise`, `--mint`, `--coral`, `--blush`, `--bloom-*`, `--hairline`) and map to Tailwind colors of the same names in `tailwind.config.ts`. shadcn semantic tokens (`--primary`, `--background`, ...) point at them.
- Prefer token classes (`bg-maroon`, `text-clay`, `font-arabic`) over hardcoded hex in new or restyled code.
- Fonts are self-hosted in `public/fonts` and declared with `@font-face` in `src/index.css`; never load fonts from Google or another third-party CDN. `font-display` and `font-body` are both Readex Pro; `font-arabic` is Aref Ruqaa, subset to the سجى wordmark (U+062C, U+0633, U+0649).
- Never put white text on coral.
- Maximum content width: `420px`, mobile-first.
- Primary buttons and feeling pills: pill shape.
- Decorative artwork stays at screen edges, never behind text, inputs or pills, and all motion is disabled under `prefers-reduced-motion`.

Do not modify files under `src/components/ui/` unless explicitly requested.

## Deployment Workflow

1. Work locally on a feature branch.
2. Run build, tests, focused lint, and `git diff --check`.
3. Push the branch to GitHub.
4. Validate the Vercel Preview deployment.
5. Merge the pull request into `main`.
6. Validate the Vercel production deployment.

Supabase migrations and Edge Functions are deployed separately from the Vercel frontend. Do not apply migrations or deploy services unless explicitly authorized.

## Resume Here

The next work should continue as small pull requests in this order:

1. Shipped: journal retry state in `src/components/JournalScreen.tsx`.
2. Shipped: deterministic crisis screening in `sakeena-reflect-v2`.
   - Screen the latest user message before Gemini generation.
   - For matched crisis language, skip Gemini and persist a standardized support response through the existing transactional RPC.
   - Use accurate Naseeha helpline wording: free, anonymous, faith-informed support available 24/7 by call or text at `1-866-627-3342`.
3. Current release: add Memory v1.
   - Memory is for authenticated users only.
   - Retrieve at most the last three completed reflections.
   - Pass only reflection date, entry text, and emotion labels into server-side Gemini context.
   - Do not pass prior AI responses or conversation turns.
   - Use remembered context subtly and only when relevant.
   - Do not add embeddings or a vector database.

## Current Priorities

1. Ship authenticated-only Memory v1 using at most the last three completed reflections.
2. Complete responsive browser checks.
3. Measure retention manually and interview users.
4. Improve follow-up prompt quality from real feedback.
5. Add active-reflection resume support.
6. Redesign journal history around the user's journey.
7. Add Ask Sajaa over recent entries.
8. Add weekly summaries if Memory v1 proves useful.
9. Test soft paywall copy before integrating payments.

## Deferred Features

Do not prioritize these until retention evidence justifies them:

- Native mobile app
- PWA installation
- Anthropic migration
- Community features
- Audio responses
- Voice input
- Prayer-time notifications
- Therapist marketplace or directory
- Payment integration
- Large content libraries

## Coding Conventions

- Read the full affected file before editing.
- Keep changes closely scoped.
- Do not refactor working code unless explicitly requested.
- Use strict TypeScript and functional React components.
- Do not install packages without approval.
- Do not manually edit generated Supabase types. Regenerate them after schema changes.
- Do not print `.env` values or secrets.
- Use product copy suitable for Muslims of all ages and genders.
- Leave the repository commit-ready.
