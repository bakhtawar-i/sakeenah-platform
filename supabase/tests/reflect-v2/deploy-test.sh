#!/usr/bin/env bash
# Deploys the merged sakeena-reflect-v2 code (sajaa-v3, PR #27) under the TEST name only:
# sakeena-reflect-v2-test. It never deploys to sakeena-reflect-v2.
#
# Run from your clone of bakhtawar-i/sakeenah-platform, logged in with `supabase login`.
# Needs the Supabase CLI. If your CLI doesn't know --use-api, drop that flag and have Docker running.
#
# The test function shares the project's secrets (GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY)
# and its database, so whatever you send it is stored in the real tables and calls Gemini.
set -euo pipefail

command -v git >/dev/null 2>&1 || { echo "ERROR: git is not installed." >&2; exit 2; }
command -v supabase >/dev/null 2>&1 || { echo "ERROR: the Supabase CLI is not installed: https://supabase.com/docs/guides/cli" >&2; exit 2; }

PROJECT_REF=cyfslxhnkfglgpcxoycn
TEST_NAME=sakeena-reflect-v2-test
SOURCE_REF=origin/sajaa-v3
SOURCE_FILE=supabase/functions/sakeena-reflect-v2/index.ts

case "$TEST_NAME" in *-test) ;; *) echo "Refusing: $TEST_NAME is not a -test name." >&2; exit 1 ;; esac

git fetch origin sajaa-v3
echo "Deploying $SOURCE_FILE from $SOURCE_REF ($(git rev-parse --short "$SOURCE_REF")) as $TEST_NAME"

# Build a throwaway project folder that contains only the test function, so the real
# sakeena-reflect-v2 folder is never part of the deploy.
WORK=$(mktemp -d)
mkdir -p "$WORK/supabase/functions/$TEST_NAME"
git show "$SOURCE_REF:$SOURCE_FILE" > "$WORK/supabase/functions/$TEST_NAME/index.ts"
printf 'project_id = "%s"\n\n[functions.%s]\nverify_jwt = false\n' "$PROJECT_REF" "$TEST_NAME" > "$WORK/supabase/config.toml"

supabase functions deploy "$TEST_NAME" \
  --project-ref "$PROJECT_REF" \
  --workdir "$WORK" \
  --no-verify-jwt \
  --use-api

echo "Deployed. Test URL: https://$PROJECT_REF.supabase.co/functions/v1/$TEST_NAME"
echo "To remove it later: supabase functions delete $TEST_NAME --project-ref $PROJECT_REF"
