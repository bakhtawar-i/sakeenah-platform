-- Scope signed-out reads of entries and usage_log to the caller's own browser session.
--
-- The original SELECT policies only required "auth.uid() IS NULL AND session_id IS NOT NULL",
-- so anyone holding the public key could read every signed-out row directly through the
-- REST API. These replacements use the same claim match as conversation_turns: the row's
-- session_id must equal the session_id claim, which public.set_request_session sets inside
-- the RPCs (get_session_entries, can_start_daily_reflection, persist_reflection_exchange).
-- Every read in the app goes through those RPCs, so nothing in the app reads these tables
-- without the claim.
--
-- Rollback: supabase/rollbacks/20261025120000_scope_anonymous_select_policies.sql
--
-- Safe to run more than once (for example once from the SQL Editor, then again by
-- `supabase db push`): each new policy is dropped first if it already exists.

-- entries: signed-out callers see only rows for their own session.
-- "Users can view own entries" (auth.uid() = user_id) already covers signed-in callers.
DROP POLICY IF EXISTS "Anonymous can view own entries"
ON public.entries;

DROP POLICY IF EXISTS "Anonymous users can view own session entries"
ON public.entries;

CREATE POLICY "Anonymous users can view own session entries"
ON public.entries
FOR SELECT
TO anon
USING (
  user_id IS NULL
  AND session_id IS NOT NULL
  AND session_id = NULLIF(current_setting('request.jwt.claims', true), '')::json->>'session_id'
);

-- usage_log: one policy for each kind of caller, replacing the combined one.
DROP POLICY IF EXISTS "Users can view own usage"
ON public.usage_log;

CREATE POLICY "Users can view own usage"
ON public.usage_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anonymous users can view own session usage"
ON public.usage_log;

CREATE POLICY "Anonymous users can view own session usage"
ON public.usage_log
FOR SELECT
TO anon
USING (
  user_id IS NULL
  AND session_id IS NOT NULL
  AND session_id = NULLIF(current_setting('request.jwt.claims', true), '')::json->>'session_id'
);
