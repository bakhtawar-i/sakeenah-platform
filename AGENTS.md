# Sajaa Agent Instructions

Read `CLAUDE.md` before editing. It is the detailed product and architecture source of truth.
When resuming work, start with its `Resume Here` section.

## Operating Rules

- Treat Sajaa as a responsive web app deployed through GitHub and Vercel.
- Do not refactor, rewrite, or change architecture unless explicitly requested.
- Keep Gemini as the AI provider unless a provider migration is explicitly requested.
- Do not weaken RLS, session isolation, or authentication checks.
- Do not add frontend direct writes to `entries`, `conversation_turns`, or `usage_log`.
- Keep reflection persistence inside transactional Supabase RPCs.
- Use `"completed"`, never `"complete"`.
- For each exchange, insert one user row and one assistant row with the same `turn_number`.
- Preserve the maximum of four exchanges.
- Keep Memory v1 server-side, authenticated-only, and bounded to at most three completed reflections.
- Do not add embeddings or a vector database for Memory v1.
- Never manually edit generated Supabase types. Regenerate them after database changes.
- Never print `.env` values, API keys, JWTs, or secrets.
- Do not apply migrations, deploy services, or push commits unless explicitly authorized.

## Product Safety

- This is an emotionally sensitive faith-native product for Muslims of all ages and genders.
- Do not claim Sajaa is therapy or a replacement for professional support.
- Never fabricate Quranic verses or Hadith.
- Preserve crisis-support behavior. Screen deterministic crisis phrases before Gemini generation and persist the standardized support response through the existing transactional RPC.
- Avoid gamification that creates guilt, pressure, or anxiety.
- Use technically accurate privacy language.

## UI Constraints

- Follow `DESIGN.md` for the Sajaa visual identity.
- Use Readex Pro for Latin text and Aref Ruqaa only for the Arabic wordmark.
- Design mobile-first around a maximum content width of `420px`.
- Do not modify `src/components/ui/` unless explicitly requested.

## Verification

For relevant changes, run:

```powershell
npm run build
npm test
npx eslint <edited-files>
git diff --check
```

For Edge Function changes, also run when Deno is available:

```powershell
deno check supabase/functions/<function-name>/index.ts
```
