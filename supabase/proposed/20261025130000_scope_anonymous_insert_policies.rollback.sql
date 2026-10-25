-- Rollback for 20261025130000_scope_anonymous_insert_policies.sql.
-- Restores the original INSERT policies from 20260413173247 exactly. Run manually in the
-- SQL editor.

BEGIN;

DROP POLICY IF EXISTS "Anonymous users can insert own session entries"
ON public.entries;

DROP POLICY IF EXISTS "Users can insert entries"
ON public.entries;

CREATE POLICY "Users can insert entries" ON public.entries FOR INSERT WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL)
);

DROP POLICY IF EXISTS "Anonymous users can insert own session usage"
ON public.usage_log;

DROP POLICY IF EXISTS "Users can insert usage"
ON public.usage_log;

CREATE POLICY "Users can insert usage" ON public.usage_log FOR INSERT WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id) OR
  (auth.uid() IS NULL AND user_id IS NULL AND session_id IS NOT NULL)
);

-- Only if this was applied through supabase/migrations:
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20261025130000';

COMMIT;
