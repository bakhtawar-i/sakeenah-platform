#!/usr/bin/env bash
# Tests the length and turn limits of sakeena-reflect-v2-test (PR #27) against the live project,
# using only throwaway identities: fresh random browser IDs and, optionally, a throwaway account.
#
#   ANON_KEY=<project publishable/anon key> ./test-limits.sh
#   ANON_KEY=... TEST_EMAIL=throwaway@example.com TEST_PASSWORD=... ./test-limits.sh   # adds signed-in checks
#
# Needs bash, curl and jq; works in Git Bash on Windows. Prints status codes, error codes and
# timings only; never prints keys, passwords, tokens or model replies.
#
# DEBUG=1 also prints, for each request: the throwaway browser ID, whether it is valid, the length
# of the key or token and body, curl's exit code and the HTTP status. Never the key, token or password.
#
# Cost: 4 Gemini calls signed out, plus 1 if signed in. Every rejection, and both crisis checks,
# happen without a model call.
#
# It writes real rows (entries, conversation_turns, usage_log) for the throwaway browser IDs it
# prints at the end, and for the throwaway account. Cleanup SQL is printed at the end.
set -uo pipefail

die() { echo "ERROR: $*" >&2; exit 2; }

# Check the tools first, so a missing one stops the run before any request is sent.
need() {
  command -v "$1" >/dev/null 2>&1 && return
  case "$1" in
    jq) die "jq is not installed. Install it, then open a new terminal and run this again:
  Windows (Git Bash): winget install jqlang.jq    (or: choco install jq)
  macOS:              brew install jq
  Debian/Ubuntu:      sudo apt install jq" ;;
    *) die "$1 is not installed." ;;
  esac
}
need curl; need jq

# clean VALUE: removes \r and \n. A value copied from a Windows file or terminal can end in \r\n,
# and a \r inside an HTTP header makes curl refuse the request (curl: (43), HTTP 000).
clean() { printf '%s' "$1" | tr -d '\r\n'; }
# valid_id VALUE: true only for letters, digits and dashes, so an ID is always safe in a header.
valid_id() { [[ "$1" =~ ^[A-Za-z0-9-]+$ ]]; }
ANON_KEY=$(clean "${ANON_KEY:-}")
TEST_EMAIL=$(clean "${TEST_EMAIL:-}")
TEST_PASSWORD=$(clean "${TEST_PASSWORD:-}")

[ -n "$ANON_KEY" ] || die "ANON_KEY is empty. Set it to the publishable (anon) key of the project:
  ANON_KEY=<key> ./test-limits.sh"
URL=${SUPABASE_URL:-https://cyfslxhnkfglgpcxoycn.supabase.co}
FN=${FN:-sakeena-reflect-v2-test}
case "$FN" in *-test) ;; *) [ "${I_MEAN_THE_REAL_FUNCTION:-}" = yes ] || { echo "Refusing to test $FN: not a -test function." >&2; exit 1; } ;; esac

PASS=0; FAIL=0; SESSIONS=()
# A random ID: uuidgen where it exists, otherwise openssl, otherwise the clock and $RANDOM
# (Git Bash on Windows has neither uuidgen nor /proc). Lowercase letters, digits and dashes only.
rand_id() {
  local id=""
  command -v uuidgen >/dev/null 2>&1 && id=$(uuidgen 2>/dev/null | tr -dc 'A-Za-z0-9-')
  [ -n "$id" ] || { command -v openssl >/dev/null 2>&1 && id=$(openssl rand -hex 16 2>/dev/null | tr -dc 'A-Za-z0-9'); }
  [ -n "$id" ] || id=$(printf '%s%s%s' "$(date +%s%N 2>/dev/null)" "$RANDOM" "$RANDOM" | tr -dc 'A-Za-z0-9')
  printf '%s' "$id" | tr -d '\r\n' | tr 'A-Z' 'a-z'
}
# new_session VAR: puts a fresh throwaway browser ID in VAR and records it for the cleanup SQL.
new_session() {
  local s
  s=$(rand_id) && [ -n "$s" ] || die "Could not generate a throwaway browser ID. Stopping before sending anything."
  s="test-$s"
  valid_id "$s" || die "Generated browser ID is not letters, digits and dashes only. Stopping before sending anything."
  # Each throwaway browser must be a different one, or the cross-browser checks would test nothing.
  for prev in "${SESSIONS[@]:-}"; do
    [ "$prev" = "$s" ] && die "The ID generator returned the same ID twice. Stopping before sending anything with it."
  done
  SESSIONS+=("$s"); printf -v "$1" '%s' "$s"
}
TMP_BODY=$(mktemp); trap 'rm -f "$TMP_BODY"' EXIT

REQ=0
# call <x-session-id> <bearer> <json body>  ->  sets STATUS, BODY, MS
call() {
  local out rc
  [ -n "$1" ] && [ -n "$2" ] && [ -n "$3" ] || die "Refusing to send a request with an empty browser ID, key or body."
  case "$1$2$ANON_KEY" in *$'\r'*|*$'\n'*) die "Refusing to send a request: a header value contains a line break." ;; esac
  REQ=$((REQ+1))
  out=$(curl -sS -o "$TMP_BODY" -w "%{http_code} %{time_total}" --max-time 60 \
    "$URL/functions/v1/$FN" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $2" -H "x-session-id: $1" \
    -H "Content-Type: application/json" -d "$3")
  rc=$?
  STATUS=${out%% *}; MS=$(awk "BEGIN{printf \"%d\", ${out##* } * 1000}")
  BODY=$(cat "$TMP_BODY")
  if [ "${DEBUG:-}" = 1 ]; then
    printf 'DEBUG #%s x-session-id=%s (%s chars, valid: %s) bearer: %s chars, body: %s bytes -> curl exit %s, HTTP %s\n' \
      "$REQ" "$1" "${#1}" "$(valid_id "$1" && echo yes || echo NO)" "${#2}" "${#3}" "$rc" "$STATUS" >&2
  fi
}
# tr -d '\r': some Windows builds of jq end lines with \r\n, which would break every comparison.
field() { jq -r "$1 // empty" <<<"$BODY" 2>/dev/null | tr -d '\r'; }
check() { # check <name> <expected status> [expected code]
  local got_code; got_code=$(field .code)
  if [ "$STATUS" = "$2" ] && { [ -z "${3:-}" ] || [ "$got_code" = "$3" ]; }; then
    PASS=$((PASS+1)); printf "PASS  %-62s %s %s (%sms)\n" "$1" "$STATUS" "$got_code" "$MS"
  else
    FAIL=$((FAIL+1)); printf "FAIL  %-62s got %s %s, expected %s %s (%sms)\n" "$1" "$STATUS" "${got_code:-}" "$2" "${3:-}" "$MS"
  fi
}

# Request bodies, built the way the app builds them.
first_body() { # first_body <entry text>
  jq -nc --arg t "$1" '{turnNumber: 1, entryText: $t, emotionLabels: ["Tired"],
    messages: [{role: "user", content: ("Journal entry: " + $t + "\n\nEmotion labels: Tired")}]}'
}
follow_body() { # follow_body <entryId> <turn> <messages json> <reply text>
  jq -nc --arg id "$1" --argjson n "$2" --argjson m "$3" --arg r "$4" \
    '{entryId: $id, turnNumber: $n, messages: ($m + [{role: "user", content: $r}])}'
}
add_turn() { # add_turn <messages json> <user text> <assistant text>  ->  new messages json
  jq -nc --argjson m "$1" --arg u "$2" --arg a "$3" '$m + [{role: "user", content: $u}, {role: "assistant", content: $a}]'
}
long() { head -c "$1" /dev/zero | tr '\0' 'a'; }

echo "Testing $URL/functions/v1/$FN"
echo

# ---------------------------------------------------------------------------------------------
echo "== Signed out: one full reflection on a throwaway browser"
new_session S1
call "$S1" "$ANON_KEY" "$(first_body "Test reflection: a long, tiring week.")"
check "turn 1, normal request" 200
ENTRY=$(field .entryId); REPLY1=$(field .response)
[ -n "$ENTRY" ] || die "Turn 1 returned no entryId (HTTP $STATUS), so the follow-up checks can't run. Stopping."
valid_id "$ENTRY" || die "Turn 1 returned an entryId that is not letters, digits and dashes only. Stopping."
MSGS=$(jq -nc --arg t "Test reflection: a long, tiring week." --arg a "$REPLY1" \
  '[{role: "user", content: ("Journal entry: " + $t + "\n\nEmotion labels: Tired")}, {role: "assistant", content: $a}]')

call "$S1" "$ANON_KEY" "$(follow_body "$ENTRY" 2 "$MSGS" "$(long 4001)")"
check "follow-up of 4001 characters is rejected" 413 too_long

call "$S1" "$ANON_KEY" "$(follow_body "$ENTRY" 2 "$MSGS" "Thank you, that helps a little.")"
check "turn 2, normal follow-up" 200
MSGS=$(add_turn "$MSGS" "Thank you, that helps a little." "$(field .response)")

call "$S1" "$ANON_KEY" "$(follow_body "$ENTRY" 2 "$(jq -c '.[0:2]' <<<"$MSGS")" "Sending turn 2 again.")"
check "turn 2 sent again (out of sync) is rejected" 409 turn_out_of_sync

new_session S2
call "$S2" "$ANON_KEY" "$(follow_body "$ENTRY" 3 "$MSGS" "From another browser.")"
check "same entry from a different browser ID is rejected" 404 entry_not_found

call "$S1" "$ANON_KEY" "$(follow_body "$ENTRY" 3 "$MSGS" "I will try to rest tonight.")"
check "turn 3" 200
MSGS=$(add_turn "$MSGS" "I will try to rest tonight." "$(field .response)")

call "$S1" "$ANON_KEY" "$(follow_body "$ENTRY" 4 "$MSGS" "Thank you.")"
check "turn 4 (the last allowed)" 200
LAST_MSGS="$MSGS"
MSGS=$(add_turn "$MSGS" "Thank you." "$(field .response)")

call "$S1" "$ANON_KEY" "$(follow_body "$ENTRY" 5 "$MSGS" "A fifth message.")"
check "5th exchange (turnNumber 5) is rejected" 409 reflection_complete
call "$S1" "$ANON_KEY" "$(follow_body "$ENTRY" 4 "$LAST_MSGS" "Turn 4 sent again.")"
check "turn 4 sent again on the finished reflection is rejected" 409 reflection_complete
[ "$(field .error)" = "This was today's reflection. Come back tomorrow." ] \
  && { PASS=$((PASS+1)); echo "PASS  calm wording on reflection_complete"; } \
  || { FAIL=$((FAIL+1)); echo "FAIL  reflection_complete wording: $(field .error)"; }

call "$S1" "$ANON_KEY" "$(first_body "A second reflection today.")"
check "second reflection on the same day hits the daily limit" 429

# ---------------------------------------------------------------------------------------------
echo
echo "== Signed out: length caps on the first reflection (fresh browsers, nothing stored)"
new_session SX; call "$SX" "$ANON_KEY" "$(first_body "$(long 601)")"
check "reflection of 601 characters is rejected" 413 too_long
BIG=$(jq -nc --arg t "short" --arg m "$(long 1001)" '{turnNumber: 1, entryText: $t, emotionLabels: [], messages: [{role: "user", content: $m}]}')
new_session SX; call "$SX" "$ANON_KEY" "$BIG"
check "short entryText but a 1001-character first message is rejected" 413 too_long

# ---------------------------------------------------------------------------------------------
echo
echo "== Crisis language: handled exactly as before"
new_session SX; call "$SX" "$ANON_KEY" "$(first_body "I want to die")"
check "crisis message gets the support response" 200
grep -q "Naseeha" <<<"$(field .response)" && grep -q "1-866-627-3342" <<<"$(field .response)" \
  && { PASS=$((PASS+1)); echo "PASS  support response names Naseeha and 1-866-627-3342"; } \
  || { FAIL=$((FAIL+1)); echo "FAIL  support response text not as expected"; }
new_session SX; call "$SX" "$ANON_KEY" "$(first_body "I want to die $(long 700)")"
check "crisis message over the length cap still gets support, not 413" 200
grep -q "Naseeha" <<<"$(field .response)" \
  && { PASS=$((PASS+1)); echo "PASS  long crisis message: support response"; } \
  || { FAIL=$((FAIL+1)); echo "FAIL  long crisis message: no support response"; }

# ---------------------------------------------------------------------------------------------
if [ -n "${TEST_EMAIL:-}" ] && [ -n "${TEST_PASSWORD:-}" ]; then
  echo
  echo "== Signed in: throwaway account"
  TOKEN=$(jq -nc --arg e "$TEST_EMAIL" --arg p "$TEST_PASSWORD" '{email: $e, password: $p}' \
    | curl -sS "$URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" -d @- \
    | jq -r '.access_token // empty' | tr -d '\r\n')
  if [ -z "$TOKEN" ]; then
    FAIL=$((FAIL+1)); echo "FAIL  could not sign in the throwaway account (confirmed? right password?)"
  else
    new_session S3
    call "$S3" "$TOKEN" "$(first_body "Signed-in test reflection.")"
    if [ "$STATUS" = 429 ]; then
      echo "SKIP  this account already reflected today (UTC); run again tomorrow or use another throwaway account"
    else
      check "signed in: turn 1" 200
      UENTRY=$(field .entryId)
      [ -n "$UENTRY" ] || die "Signed-in turn 1 returned no entryId (HTTP $STATUS). Stopping."
      valid_id "$UENTRY" || die "Signed-in turn 1 returned an entryId that is not letters, digits and dashes only. Stopping."
      UMSGS=$(jq -nc --arg a "$(field .response)" '[{role: "user", content: "Journal entry: Signed-in test reflection.\n\nEmotion labels: Tired"}, {role: "assistant", content: $a}]')
      call "$S3" "$TOKEN" "$(follow_body "$UENTRY" 3 "$UMSGS" "Skipping turn 2.")"
      check "signed in: skipping a turn is rejected" 409 turn_out_of_sync
      call "$S3" "$TOKEN" "$(follow_body "$UENTRY" 5 "$UMSGS" "Turn 5.")"
      check "signed in: turnNumber 5 is rejected" 409 reflection_complete
      call "$S3" "$TOKEN" "$(follow_body "$UENTRY" 2 "$UMSGS" "$(long 4001)")"
      check "signed in: follow-up of 4001 characters is rejected" 413 too_long
      new_session S4
      call "$S4" "$ANON_KEY" "$(follow_body "$UENTRY" 2 "$UMSGS" "Signed out, same entry.")"
      check "signed out with a new browser ID cannot use the account's entry" 404 entry_not_found
    fi
  fi
else
  echo
  echo "(Signed-in checks skipped: set TEST_EMAIL and TEST_PASSWORD for a throwaway, confirmed account.)"
fi

# ---------------------------------------------------------------------------------------------
echo
echo "$PASS passed, $FAIL failed"
echo
echo "Throwaway browser IDs used (only these rows were written while signed out):"
printf '  %s\n' "${SESSIONS[@]}"
echo
echo "Optional cleanup, in the SQL Editor (deletes only rows for these test browser IDs):"
LIST=$(printf "'%s'," "${SESSIONS[@]}"); LIST=${LIST%,}
echo "  delete from public.conversation_turns where session_id in ($LIST);"
echo "  delete from public.usage_log where session_id in ($LIST);"
echo "  delete from public.entries where session_id in ($LIST);"
[ -n "${TEST_EMAIL:-}" ] && echo "  -- The throwaway account's rows: delete the account in Authentication > Users (rows cascade)."
[ "$FAIL" = 0 ]
