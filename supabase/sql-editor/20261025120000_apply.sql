-- =============================================================================
-- SAJAA: APPLY THE SIGNED-OUT READ FIX (keeps the change)
-- =============================================================================
--
-- WHAT THIS DOES
--   Applies migration 20261025120000 from the Supabase SQL Editor. It replaces
--   the signed-out SELECT policies on `entries` and `usage_log`, which let anyone
--   with the public key read every signed-out row, with policies that only match
--   rows for the caller's own browser ID. Signed-in access is unchanged.
--
--   The statements are the same as
--   supabase/migrations/20261025120000_scope_anonymous_select_policies.sql.
--   Run 20261025120000_check_in_rollback.sql first and confirm every row says PASS.
--
-- HOW IT IS SAVED
--   - There is no BEGIN/ROLLBACK, so this one keeps the change.
--   - The editor sends the whole file as one request, which PostgreSQL runs as a
--     single transaction: either every statement is applied or none is.
--   - It is safe to run twice, and safe if `supabase db push` applies the same
--     migration later.
--   - This does not record the migration in the CLI's history. If you also use
--     `supabase db push`, it will run the migration again, which is harmless
--     because every statement drops before it creates.
--
-- WHILE IT RUNS
--   It briefly locks entries and usage_log, usually well under a second. If it
--   can't get the lock within 5 seconds, it stops and changes nothing; run it
--   again.
--
-- TO UNDO
--   Run supabase/rollbacks/20261025120000_scope_anonymous_select_policies.sql.
--
-- WHAT YOU SEE
--   The final SELECT lists the SELECT policies now on the two tables (names,
--   roles and one PASS or FAIL per row). It reads no table rows.
-- =============================================================================

SET lock_timeout = '5s';

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

RESET lock_timeout;

-- Check: exactly these SELECT policies should now exist, and the old one on entries
-- should be gone. Reads policy definitions only, no table rows.
WITH expected (tablename, policyname, roles) AS (
  VALUES
    ('entries',   'Users can view own entries',                     '{public}'),
    ('entries',   'Anonymous users can view own session entries',   '{anon}'),
    ('usage_log', 'Users can view own usage',                       '{authenticated}'),
    ('usage_log', 'Anonymous users can view own session usage',     '{anon}')
),
actual AS (
  SELECT tablename::text, policyname::text, roles::text
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('entries', 'usage_log')
    AND cmd = 'SELECT'
)
SELECT
  coalesce(e.tablename, a.tablename) AS table_name,
  coalesce(e.policyname, a.policyname) AS select_policy,
  coalesce(a.roles, 'missing') AS roles,
  CASE
    WHEN e.policyname IS NULL THEN 'FAIL: unexpected policy'
    WHEN a.policyname IS NULL THEN 'FAIL: missing'
    WHEN a.roles <> e.roles THEN 'FAIL: wrong role'
    ELSE 'PASS'
  END AS result
FROM expected e
FULL JOIN actual a USING (tablename, policyname)
ORDER BY 1, 2;
