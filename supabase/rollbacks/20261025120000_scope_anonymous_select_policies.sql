-- Rollback for supabase/migrations/20261025120000_scope_anonymous_select_policies.sql.
-- Restores the original SELECT policies from 20260413173247 exactly, including the
-- signed-out exposure they had. Run manually in the SQL editor; this folder is not
-- applied by `supabase db push`.

BEGIN;

DROP POLICY IF EXISTS "Anonymous users can view own session entries"
ON public.entries;

DROP POLICY IF EXISTS "Anonymous can view own entries"
ON public.entries;

CREATE POLICY "Anonymous can view own entries" ON public.entries FOR SELECT USING (
  auth.uid() IS NULL AND session_id IS NOT NULL
);

DROP POLICY IF EXISTS "Anonymous users can view own session usage"
ON public.usage_log;

DROP POLICY IF EXISTS "Users can view own usage"
ON public.usage_log;

CREATE POLICY "Users can view own usage" ON public.usage_log FOR SELECT USING (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (auth.uid() IS NULL AND session_id IS NOT NULL)
);

-- Remove the migration's row from the CLI history so it can be pushed again later.
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20261025120000';

COMMIT;
