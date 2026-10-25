-- =============================================================================
-- SAJAA: CHECK THE SIGNED-OUT READ FIX WITHOUT KEEPING IT (always rolls back)
-- =============================================================================
--
-- WHAT THIS DOES
--   Proves, on the real database, that migration 20261025120000 closes the
--   signed-out read leak on `entries` and `usage_log`, then throws every change
--   away. Paste the whole file into the Supabase SQL Editor and press Run.
--
--   1. Counts how many rows the current policies expose to a signed-out caller
--      (every row that has a browser ID).
--   2. As a signed-out caller (role `anon`) with a made-up browser ID, counts the
--      rows it can see in entries, usage_log and conversation_turns. Before the
--      fix this matches the leak; conversation_turns is the control that already
--      uses the correct pattern, so it should be 0.
--   3. As a signed-in caller (role `authenticated`) with a made-up user ID that
--      owns nothing, counts the same tables. This should be 0.
--   4. Applies the fix: the same statements as
--      supabase/migrations/20261025120000_scope_anonymous_select_policies.sql.
--   5. Repeats steps 2 and 3. Every count should now be 0.
--   6. Proves the fix doesn't hide a browser's own rows. It adds one test entry
--      and one usage row for a second made-up browser ID, then checks that this
--      browser sees exactly those, both directly and through the app's own
--      functions (get_session_entries, can_start_daily_reflection), and that
--      nobody else sees them.
--   7. Shows one table, with one row per check (expected, actual, PASS or FAIL)
--      and a first row summarising them all.
--
-- WHY NOTHING IS KEPT
--   - It starts with BEGIN and ends with ROLLBACK, so the policy change and the
--     two test rows are undone.
--   - If anything fails part way, PostgreSQL aborts the transaction, and an
--     aborted transaction can't save anything either.
--   - The test rows are never visible to the app or anyone else, because other
--     connections only ever see committed data.
--
-- WHAT IT READS
--   Only counts. It never selects reflection text, browser IDs, user IDs or any
--   other row contents. The only IDs it uses are the made-up ones below.
--
-- WHILE IT RUNS
--   Changing a policy briefly locks entries and usage_log, so app requests that
--   touch them wait until the ROLLBACK, usually well under a second. lock_timeout
--   makes the script give up after 5 seconds instead of holding up the app if
--   it can't get the lock.
--
-- WHAT TO EXPECT
--   - Every row says PASS, including the first ("All checks").
--   - Row 1 also shows the size of the current leak: 24 for entries when this
--     was written.
--   - If the fix is already live, the two "before fix" leak rows show FAIL with
--     an actual of 0. That means the leak is already closed, not that anything
--     broke.
--
-- The SQL Editor shows only the last result that has rows, which is the final
-- SELECT (ROLLBACK returns none).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Made-up identities for this check only. These strings aren't in the format the
-- app uses for browser IDs, so they can't match a real one.
SELECT
  set_config('rls_check.made_up_browser', 'rls-check-made-up-browser', true),
  set_config('rls_check.test_browser', 'rls-check-test-browser', true),
  set_config('rls_check.made_up_user', gen_random_uuid()::text, true);

-- 1. Size of the current leak, counted as the editor's role (not limited by RLS):
--    the current signed-out policies expose every row that has a browser ID.
SELECT
  set_config('rls_check.leak_entries',
    (SELECT count(*) FROM public.entries WHERE session_id IS NOT NULL)::text, true),
  set_config('rls_check.leak_usage',
    (SELECT count(*) FROM public.usage_log WHERE session_id IS NOT NULL)::text, true),
  set_config('rls_check.made_up_user_owns',
    ((SELECT count(*) FROM public.entries WHERE user_id = current_setting('rls_check.made_up_user')::uuid)
     + (SELECT count(*) FROM public.usage_log WHERE user_id = current_setting('rls_check.made_up_user')::uuid))::text, true);

-- 2. BEFORE the fix, signed out, made-up browser ID.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims',
  json_build_object('role', 'anon', 'session_id', current_setting('rls_check.made_up_browser'))::text, true);
SELECT
  set_config('rls_check.before_anon_entries', (SELECT count(*) FROM public.entries)::text, true),
  set_config('rls_check.before_anon_usage', (SELECT count(*) FROM public.usage_log)::text, true),
  set_config('rls_check.before_anon_turns', (SELECT count(*) FROM public.conversation_turns)::text, true);
RESET ROLE;

-- 3. BEFORE the fix, signed in as a made-up user who owns nothing.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', current_setting('rls_check.made_up_user'))::text, true);
SELECT
  set_config('rls_check.before_user_entries', (SELECT count(*) FROM public.entries)::text, true),
  set_config('rls_check.before_user_usage', (SELECT count(*) FROM public.usage_log)::text, true);
RESET ROLE;
SELECT set_config('request.jwt.claims', '', true);

-- 4. Apply the fix. Same statements as
--    supabase/migrations/20261025120000_scope_anonymous_select_policies.sql.
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

-- 6 (set-up). One test entry and one usage row for the second made-up browser.
--    Undone by the ROLLBACK, and never visible to any other connection.
INSERT INTO public.entries (session_id, entry_text, ai_response)
VALUES (current_setting('rls_check.test_browser'), 'RLS check row, rolled back', 'RLS check row, rolled back');
INSERT INTO public.usage_log (session_id)
VALUES (current_setting('rls_check.test_browser'));

-- 5. AFTER the fix, signed out, the same made-up browser ID.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims',
  json_build_object('role', 'anon', 'session_id', current_setting('rls_check.made_up_browser'))::text, true);
SELECT
  set_config('rls_check.after_anon_entries', (SELECT count(*) FROM public.entries)::text, true),
  set_config('rls_check.after_anon_usage', (SELECT count(*) FROM public.usage_log)::text, true),
  set_config('rls_check.after_anon_turns', (SELECT count(*) FROM public.conversation_turns)::text, true),
  set_config('rls_check.after_anon_rpc',
    (SELECT count(*) FROM public.get_session_entries(current_setting('rls_check.made_up_browser')))::text, true);
RESET ROLE;

-- 5. AFTER the fix, signed in as the same made-up user.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', current_setting('rls_check.made_up_user'))::text, true);
SELECT
  set_config('rls_check.after_user_entries', (SELECT count(*) FROM public.entries)::text, true),
  set_config('rls_check.after_user_usage', (SELECT count(*) FROM public.usage_log)::text, true);
RESET ROLE;

-- 6. AFTER the fix, signed out as the test browser: it sees exactly its own rows.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims',
  json_build_object('role', 'anon', 'session_id', current_setting('rls_check.test_browser'))::text, true);
SELECT
  set_config('rls_check.own_entries', (SELECT count(*) FROM public.entries)::text, true),
  set_config('rls_check.own_usage', (SELECT count(*) FROM public.usage_log)::text, true);
RESET ROLE;

-- 6. The app's own read path, as a fresh signed-out request with no claim set:
--    the function sets the claim itself.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT
  set_config('rls_check.own_rpc',
    (SELECT count(*) FROM public.get_session_entries(current_setting('rls_check.test_browser')))::text, true),
  set_config('rls_check.own_can_start',
    public.can_start_daily_reflection(current_setting('rls_check.test_browser'))::text, true);
RESET ROLE;

-- 7. Results. Only counts and true/false, never row contents.
WITH checks (n, check_name, expected, actual) AS (
  VALUES
    (1,  'Before fix: signed out, made-up browser, entries visible (the leak)',
         current_setting('rls_check.leak_entries'), current_setting('rls_check.before_anon_entries')),
    (2,  'Before fix: signed out, made-up browser, usage_log visible (the leak)',
         current_setting('rls_check.leak_usage'), current_setting('rls_check.before_anon_usage')),
    (3,  'Before fix: signed out, made-up browser, conversation_turns visible (already safe)',
         '0', current_setting('rls_check.before_anon_turns')),
    (4,  'Made-up signed-in user owns no rows (sanity check)',
         '0', current_setting('rls_check.made_up_user_owns')),
    (5,  'Before fix: signed in, made-up user, entries visible',
         '0', current_setting('rls_check.before_user_entries')),
    (6,  'Before fix: signed in, made-up user, usage_log visible',
         '0', current_setting('rls_check.before_user_usage')),
    (7,  'After fix: signed out, made-up browser, entries visible',
         '0', current_setting('rls_check.after_anon_entries')),
    (8,  'After fix: signed out, made-up browser, usage_log visible',
         '0', current_setting('rls_check.after_anon_usage')),
    (9,  'After fix: signed out, made-up browser, conversation_turns visible',
         '0', current_setting('rls_check.after_anon_turns')),
    (10, 'After fix: signed out, made-up browser, rows from get_session_entries',
         '0', current_setting('rls_check.after_anon_rpc')),
    (11, 'After fix: signed in, made-up user, entries visible',
         '0', current_setting('rls_check.after_user_entries')),
    (12, 'After fix: signed in, made-up user, usage_log visible',
         '0', current_setting('rls_check.after_user_usage')),
    (13, 'After fix: test browser sees its own test entry, and nothing else',
         '1', current_setting('rls_check.own_entries')),
    (14, 'After fix: test browser sees its own usage row, and nothing else',
         '1', current_setting('rls_check.own_usage')),
    (15, 'After fix: get_session_entries returns the test browser''s entry',
         '1', current_setting('rls_check.own_rpc')),
    (16, 'After fix: daily limit sees the test browser''s usage (can start = false)',
         'false', current_setting('rls_check.own_can_start'))
)
SELECT check_name, expected, actual, result
FROM (
  SELECT 0 AS n,
         'All checks' AS check_name,
         count(*) || ' PASS' AS expected,
         count(*) FILTER (WHERE expected = actual) || ' PASS' AS actual,
         CASE WHEN bool_and(expected = actual) THEN 'PASS' ELSE 'FAIL' END AS result
  FROM checks
  UNION ALL
  SELECT n, check_name, expected, actual,
         CASE WHEN expected = actual THEN 'PASS' ELSE 'FAIL' END
  FROM checks
) AS results
ORDER BY n;

ROLLBACK;
