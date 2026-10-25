#!/bin/bash
# Local RLS check for entries, usage_log and conversation_turns. Never point this at a real
# Supabase project: it drops and recreates the databases "sajaa" and "orig" on the server
# given by PGHOST/PGPORT/PGUSER (default 127.0.0.1:55432, user postgres), which should be a
# throwaway local Postgres 15+.
#
# It applies every migration in supabase/migrations up to 20260601 on a minimal Supabase
# stand-in (bootstrap.sql), seeds two browser sessions and two accounts through the app's own
# RPCs, then checks who can read and write what: before the fix, after
# 20261025120000_scope_anonymous_select_policies.sql, after the proposed insert policies, and
# after both rollbacks. It runs requests the way PostgREST does (one transaction, SET LOCAL
# ROLE, request.jwt.claims and request.headers), but it is not PostgREST or Supabase Auth, so
# the scratch-project test plan in the PR is still needed.
S=$(cd "$(dirname "$0")" && pwd); REPO=$(cd "$S/../../.." && pwd)
export PGHOST=${PGHOST:-127.0.0.1} PGPORT=${PGPORT:-55432} PGUSER=${PGUSER:-postgres}
PASS=0; FAIL=0
U=11111111-1111-1111-1111-111111111111      # signed-in test account
V=22222222-2222-2222-2222-222222222222      # second account, for claim tests
A=aaaaaaaa-0000-4000-8000-00000000000a      # browser A
B=bbbbbbbb-0000-4000-8000-00000000000b      # browser B
admin() { psql -X -q -v ON_ERROR_STOP=1 -d sajaa -Atc "$1"; }
# One request as PostgREST would run it: own transaction, role, JWT claims and headers.
req() { # req <anon|user-uuid> <x-session-id> <sql>
  local who=$1 sess=$2 sql=$3 role claims
  if [ "$who" = anon ]; then role=anon; claims='{"role":"anon"}'; else role=authenticated; claims="{\"role\":\"authenticated\",\"sub\":\"$who\"}"; fi
  psql -X -q -d sajaa -At 2>&1 <<SQL | grep -v '^$' | grep -v '^set_config' | tr '\n' ' ' | sed 's/ $//'
BEGIN;
SET LOCAL ROLE $role;
SELECT set_config('request.jwt.claims', '$claims', true) \g /dev/null
SELECT set_config('request.headers', '{"x-session-id":"$sess"}', true) \g /dev/null
$sql;
COMMIT;
SQL
}
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS $1"; else FAIL=$((FAIL+1)); echo "FAIL $1"; echo "     expected: $3"; echo "     got:      $2"; fi; }
contains() { if [[ "$2" == *"$3"* ]]; then PASS=$((PASS+1)); echo "PASS $1"; else FAIL=$((FAIL+1)); echo "FAIL $1"; echo "     expected to contain: $3"; echo "     got: $2"; fi; }
persist() { # persist <who> <sess> <entry-id|NULL> <text> <turn>
  local eid=$3; [ "$eid" != NULL ] && eid="'$eid'"
  req "$1" "$2" "SELECT public.persist_reflection_exchange('$2', $eid, '$4', ARRAY['Sad'], 'reply to $4', '[{\"role\":\"user\",\"content\":\"$4\"}]'::jsonb, $5)"
}

EXISTING=($REPO/supabase/migrations/2026041*.sql $REPO/supabase/migrations/2026052*.sql $REPO/supabase/migrations/2026053*.sql $REPO/supabase/migrations/20260601*.sql)
POLICIES="SELECT string_agg(tablename||'.'||policyname||':'||cmd||':'||coalesce(qual, with_check), ' | ' ORDER BY tablename, policyname) FROM pg_policies WHERE tablename IN ('entries','usage_log') AND cmd IN ('SELECT','INSERT')"
for db in orig sajaa; do
  psql -X -q -d postgres -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db" >/dev/null 2>&1
  psql -X -q -v ON_ERROR_STOP=1 -d $db -f $S/bootstrap.sql >/dev/null || exit 1
  for f in "${EXISTING[@]}"; do
    psql -X -q -v ON_ERROR_STOP=1 -d $db -f "$f" >/dev/null 2>&1 || { echo "migration failed: $f"; exit 1; }
  done
done
ORIGINAL_POLICIES=$(psql -X -d orig -Atc "$POLICIES")
echo "== existing migrations applied"

# Seed through the app's own RPC, as the edge function does.
admin "INSERT INTO auth.users VALUES ('$U'), ('$V')"
EA=$(persist anon $A NULL "A secret" 1)
EB=$(persist anon $B NULL "B secret" 1)
EU=$(persist $U $A NULL "U secret" 1)
persist anon $A "$EA" "A follow" 2 >/dev/null
# A row shaped like the pre-14-April code wrote: account AND browser ID both set.
admin "INSERT INTO public.entries (user_id, session_id, entry_text, ai_response) VALUES ('$U', 'legacy-browser', 'U legacy secret', 'r')"
check "seed: three entries created through persist_reflection_exchange" "$(admin "SELECT count(*) FROM entries WHERE entry_text IN ('A secret','B secret','U secret')")" 3

echo "== BEFORE the fix (current policies)"
check "anon, no RPC: select * from entries returns every signed-out row (the exposure)" "$(req anon "" "SELECT string_agg(entry_text, ',' ORDER BY entry_text) FROM entries")" "A secret,B secret,U legacy secret"
check "anon, no RPC: select * from usage_log returns every signed-out row" "$(req anon "" "SELECT count(*) FROM usage_log")" 2
check "anon, no RPC: session IDs are enumerable" "$(req anon "" "SELECT count(DISTINCT session_id) FROM entries")" 3

echo "== AFTER the fix"
psql -X -q -v ON_ERROR_STOP=1 -d sajaa -f $REPO/supabase/migrations/20261025120000_scope_anonymous_select_policies.sql >/dev/null || exit 1
for who in "anon:" "anon:$A" "anon:$B" "anon:made-up-id"; do
  s=${who#anon:}
  check "anon (x-session-id='$s'), no RPC: select * from entries → 0 rows" "$(req anon "$s" "SELECT count(*) FROM entries")" 0
  check "anon (x-session-id='$s'), no RPC: select * from usage_log → 0 rows" "$(req anon "$s" "SELECT count(*) FROM usage_log")" 0
done
check "anon, no RPC: claim forged in a separate set_request_session call does not carry over" "$(req anon "$A" "SELECT public.set_request_session('$A')") $(req anon "$A" "SELECT count(*) FROM entries")" " 0"
check "browser A via get_session_entries: only A's entry" "$(req anon $A "SELECT string_agg(entry_text, ',') FROM get_session_entries('$A')")" "A secret"
check "browser B via get_session_entries: only B's entry" "$(req anon $B "SELECT string_agg(entry_text, ',') FROM get_session_entries('$B')")" "B secret"
check "made-up browser ID via get_session_entries: nothing" "$(req anon x "SELECT count(*) FROM get_session_entries('made-up-id')")" 0
contains "empty browser ID via get_session_entries: error, no rows" "$(req anon "" "SELECT count(*) FROM get_session_entries('')")" "Missing session_id"
contains "null browser ID via get_session_entries: error, no rows" "$(req anon "" "SELECT count(*) FROM get_session_entries(NULL)")" "Missing session_id"
check "browser A, inside an RPC transaction, select * from entries: only A" "$(req anon $A "SELECT public.set_request_session('$A') \g /dev/null
SELECT string_agg(entry_text, ',') FROM entries")" "A secret"
check "signed-in U, no RPC: select * from entries → only U's rows" "$(req $U "" "SELECT string_agg(entry_text, ',' ORDER BY entry_text) FROM entries")" "U legacy secret,U secret"
check "signed-in U via get_session_entries: only U's rows" "$(req $U $A "SELECT string_agg(entry_text, ',' ORDER BY entry_text) FROM get_session_entries('$A')")" "U legacy secret,U secret"
check "signed-in U, no RPC: usage_log → only U's row" "$(req $U "" "SELECT count(*) FROM usage_log")" 1
check "signed-in V: sees nothing of U, A or B" "$(req $V "" "SELECT count(*) FROM entries") $(req $V "" "SELECT count(*) FROM usage_log") $(req $V "" "SELECT count(*) FROM conversation_turns")" "0 0 0"
check "conversation_turns unchanged: anon sees 0 without RPC" "$(req anon $A "SELECT count(*) FROM conversation_turns")" 0
check "legacy row (account + browser ID) hidden from anon" "$(req anon legacy-browser "SELECT count(*) FROM get_session_entries('legacy-browser')")" 0

echo "== app paths still work after the fix"
check "can_start_daily_reflection: A has reflected today" "$(req anon $A "SELECT can_start_daily_reflection('$A')")" f
check "can_start_daily_reflection: a fresh browser can start" "$(req anon fresh "SELECT can_start_daily_reflection('fresh')")" t
check "can_start_daily_reflection: U has reflected today" "$(req $U $A "SELECT can_start_daily_reflection('$A')")" f
EF=$(persist anon fresh NULL "fresh secret" 1)
check "persist turn 1, signed out (INSERT ... RETURNING passes the new policy)" "$(admin "SELECT entry_text FROM entries WHERE id = '$EF'")" "fresh secret"
for t in 2 3 4; do persist anon fresh "$EF" "fresh $t" $t >/dev/null; done
check "persist turns 2-4, signed out: completed with 4 turns, 8 turn rows" "$(admin "SELECT status, turn_count FROM entries WHERE id = '$EF'") $(admin "SELECT count(*) FROM conversation_turns WHERE entry_id = '$EF'")" "completed|4 8"
contains "persist turn 5 still refused" "$(persist anon fresh "$EF" "fresh 5" 5)" "Invalid turn number"
contains "daily limit still enforced in persist" "$(persist anon fresh NULL "again" 1)" "Daily reflection limit reached"
persist $U $A "$EU" "U follow" 2 >/dev/null
check "persist follow-up, signed in" "$(admin "SELECT turn_count FROM entries WHERE id = '$EU'")" 2
contains "browser B cannot persist into A's entry" "$(persist anon $B "$EA" "B into A" 3)" "Entry not found"
contains "made-up browser cannot persist into A's entry" "$(persist anon made-up "$EA" "x" 3)" "Entry not found"
contains "signed-in V cannot persist into U's entry" "$(persist $V x "$EU" "x" 3)" "Entry not found"
check "A's entry unchanged by those attempts" "$(admin "SELECT turn_count FROM entries WHERE id = '$EA'")" 2
check "get_recent_completed_reflections, signed in: runs" "$(req $U "" "SELECT count(*) FROM get_recent_completed_reflections(3)")" 0
contains "get_recent_completed_reflections, signed out: refused" "$(req anon $A "SELECT count(*) FROM get_recent_completed_reflections(3)")" "permission denied"
# Claim: browser B's session moves to account V.
check "claim_anonymous_session moves B's rows to V" "$(req $V $B "SELECT entries_claimed||','||usage_claimed||','||turns_claimed FROM claim_anonymous_session('$B')")" "1,1,2"
check "claimed rows: session_id cleared" "$(admin "SELECT count(*) FROM entries WHERE user_id = '$V' AND session_id IS NOT NULL")" 0
check "after claim, V sees B's entry; browser B no longer does" "$(req $V "" "SELECT string_agg(entry_text, ',') FROM get_session_entries('$B')") $(req anon $B "SELECT count(*) FROM get_session_entries('$B')")" "B secret 0"
contains "claim with mismatched header refused" "$(req $V $A "SELECT * FROM claim_anonymous_session('other')")" "Session header mismatch"
contains "claim with empty ID refused" "$(req $V "" "SELECT * FROM claim_anonymous_session('')")" "Missing session_id"
contains "claim by a signed-out caller refused" "$(req anon $A "SELECT * FROM claim_anonymous_session('$A')")" "permission denied"
check "claim with a made-up ID claims nothing" "$(req $V made-up "SELECT entries_claimed FROM claim_anonymous_session('made-up')")" 0

echo "== not fixed here: direct updates by the owner"
check "signed-in U can reset own entry's turn count directly (unchanged by this PR)" "$(req $U "" "UPDATE entries SET turn_count = 1, status = 'active' WHERE id = '$EU' RETURNING turn_count")" "1"
check "signed-out caller cannot update directly (claim needed)" "$(req anon $A "UPDATE entries SET turn_count = 1 WHERE id = '$EA' RETURNING turn_count")" ""
admin "UPDATE entries SET turn_count = 2 WHERE id = '$EU'"

echo "== step 2 (proposed): insert policies"
req anon "" "INSERT INTO entries (session_id, entry_text, ai_response) VALUES ('$A', 'planted', 'r')" >/dev/null
check "BEFORE step 2: anon inserts an entry for browser A directly, and it lands in A's journal" "$(req anon $A "SELECT count(*) FROM get_session_entries('$A') WHERE entry_text = 'planted'")" 1
admin "DELETE FROM entries WHERE entry_text = 'planted'"
psql -X -q -v ON_ERROR_STOP=1 -d sajaa -f $REPO/supabase/proposed/20261025130000_scope_anonymous_insert_policies.sql >/dev/null || exit 1
contains "AFTER step 2: direct anon insert into entries refused" "$(req anon $A "INSERT INTO entries (session_id, entry_text, ai_response) VALUES ('$A', 'planted', 'r')")" "row-level security"
contains "AFTER step 2: direct anon insert into usage_log refused" "$(req anon $A "INSERT INTO usage_log (session_id) VALUES ('$A')")" "row-level security"
contains "AFTER step 2: signed-in insert for another account refused" "$(req $U "" "INSERT INTO entries (user_id, entry_text, ai_response) VALUES ('$V', 'x', 'r')")" "row-level security"
EG=$(persist anon newbrowser NULL "new secret" 1)
check "AFTER step 2: signed-out saving through the RPC still works" "$(admin "SELECT count(*) FROM entries WHERE id = '$EG'") $(admin "SELECT count(*) FROM usage_log WHERE session_id = 'newbrowser'")" "1 1"
admin "INSERT INTO auth.users VALUES ('33333333-3333-3333-3333-333333333333')"
EW=$(persist 33333333-3333-3333-3333-333333333333 any NULL "W secret" 1)
check "AFTER step 2: signed-in saving through the RPC still works" "$(admin "SELECT count(*) FROM entries WHERE id = '$EW'")" 1

echo "== rollbacks"
psql -X -q -v ON_ERROR_STOP=1 -d sajaa -f $REPO/supabase/proposed/20261025130000_scope_anonymous_insert_policies.rollback.sql >/dev/null || exit 1
psql -X -q -v ON_ERROR_STOP=1 -d sajaa -f $REPO/supabase/rollbacks/20261025120000_scope_anonymous_select_policies.sql >/dev/null || exit 1
check "rollback restores the original policy definitions" "$(admin "$POLICIES")" "$ORIGINAL_POLICIES"
psql -X -q -v ON_ERROR_STOP=1 -d sajaa -f $REPO/supabase/migrations/20261025120000_scope_anonymous_select_policies.sql >/dev/null && check "fix applies again cleanly after rollback" ok ok

echo; echo "$PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
