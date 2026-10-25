-- PROPOSED, step 2. Not in supabase/migrations, so `supabase db push` does not apply it.
-- Once approved, and once 20261025120000 is live and checked, move it into supabase/migrations.
--
-- Scope signed-out inserts into entries and usage_log to the caller's own browser session.
--
-- The original INSERT policies let a signed-out caller insert rows for any session_id
-- directly through the REST API: write entries into someone else's journal if their
-- browser ID is known, add usage rows that use up someone else's daily reflection, or
-- skip the daily limit and the transactional RPC entirely. The app never inserts into
-- these tables directly; persist_reflection_exchange does, after set_request_session has
-- set the session_id claim. So requiring the claim match blocks direct inserts and keeps
-- saving working.
--
-- Signed-in callers keep the same rule as before (auth.uid() = user_id), now as its own
-- policy for the authenticated role.
--
-- Rollback: supabase/proposed/20261025130000_scope_anonymous_insert_policies.rollback.sql

DROP POLICY IF EXISTS "Users can insert entries"
ON public.entries;

CREATE POLICY "Users can insert entries"
ON public.entries
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous users can insert own session entries"
ON public.entries
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND session_id IS NOT NULL
  AND session_id = NULLIF(current_setting('request.jwt.claims', true), '')::json->>'session_id'
);

DROP POLICY IF EXISTS "Users can insert usage"
ON public.usage_log;

CREATE POLICY "Users can insert usage"
ON public.usage_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous users can insert own session usage"
ON public.usage_log
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND session_id IS NOT NULL
  AND session_id = NULLIF(current_setting('request.jwt.claims', true), '')::json->>'session_id'
);
