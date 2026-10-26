#!/usr/bin/env bash
# Confirms the live sakeena-reflect-v2 has the generous caps from PR #27: 600 characters for a
# reflection, 1,000 for the first message, 4,000 for a follow-up.
#
#   ANON_KEY=<project publishable/anon key> ./caps-check.sh
#
# For each cap it sends a request exactly AT the cap and one character OVER:
#   - over the cap: 413 too_long, rejected before anything else
#   - at the cap: must get past the length check, so it's stopped by a later check that costs
#     nothing. For reflections that's the daily limit (429, on a throwaway browser that has already
#     reflected today); for follow-ups it's an entry that doesn't exist (404).
# If the deployed caps were the tight ones (300 / 1,000), the "at the cap" reflection requests
# would come back 413 instead.
#
# Cost: one Gemini call and one stored reflection, the seed reflection for the throwaway browser.
# Needs bash, curl and jq; works in Git Bash on Windows. Prints status codes only.
#
# DEBUG=1 also prints, for each request: the throwaway browser ID, whether it is valid, the length
# of the key and body, curl's exit code and the HTTP status. Never the key itself.
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

[ -n "$ANON_KEY" ] || die "ANON_KEY is empty. Set it to the publishable (anon) key of the project:
  ANON_KEY=<key> ./caps-check.sh"
URL=${SUPABASE_URL:-https://cyfslxhnkfglgpcxoycn.supabase.co}
FN=${FN:-sakeena-reflect-v2}

# A random ID: uuidgen where it exists, otherwise openssl, otherwise the clock and $RANDOM
# (Git Bash on Windows has neither uuidgen nor /proc). Lowercase letters, digits and dashes only.
rand_id() {
  local id=""
  command -v uuidgen >/dev/null 2>&1 && id=$(uuidgen 2>/dev/null | tr -dc 'A-Za-z0-9-')
  [ -n "$id" ] || { command -v openssl >/dev/null 2>&1 && id=$(openssl rand -hex 16 2>/dev/null | tr -dc 'A-Za-z0-9'); }
  [ -n "$id" ] || id=$(printf '%s%s%s' "$(date +%s%N 2>/dev/null)" "$RANDOM" "$RANDOM" | tr -dc 'A-Za-z0-9')
  printf '%s' "$id" | tr -d '\r\n' | tr 'A-Z' 'a-z'
}
# new_id VAR: puts a fresh random ID in VAR, or stops the run if none could be made.
new_id() {
  local id
  id=$(rand_id) && [ -n "$id" ] || die "Could not generate a random ID. Stopping before sending anything."
  valid_id "$id" || die "Generated ID is not letters, digits and dashes only. Stopping before sending anything."
  printf -v "$1" '%s' "$id"
}
new_id S; S="test-$S"
valid_id "$S" || die "Browser ID is not letters, digits and dashes only. Stopping before sending anything."
TMP_BODY=$(mktemp); trap 'rm -f "$TMP_BODY"' EXIT
PASS=0; FAIL=0; REQ=0

call() { # call <json body>  ->  STATUS, CODE
  local rc
  [ -n "$S" ] && [ -n "$1" ] || die "Refusing to send a request with an empty browser ID or body."
  case "$S$ANON_KEY" in *$'\r'*|*$'\n'*) die "Refusing to send a request: a header value contains a line break." ;; esac
  REQ=$((REQ+1))
  STATUS=$(curl -sS -o "$TMP_BODY" -w "%{http_code}" --max-time 60 "$URL/functions/v1/$FN" \
    -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "x-session-id: $S" \
    -H "Content-Type: application/json" -d "$1")
  rc=$?
  # tr -d '\r': some Windows builds of jq end lines with \r\n, which would break every comparison.
  CODE=$(jq -r '.code // empty' "$TMP_BODY" 2>/dev/null | tr -d '\r')
  if [ "${DEBUG:-}" = 1 ]; then
    printf 'DEBUG #%s x-session-id=%s (%s chars, valid: %s) key: %s chars, body: %s bytes -> curl exit %s, HTTP %s\n' \
      "$REQ" "$S" "${#S}" "$(valid_id "$S" && echo yes || echo NO)" "${#ANON_KEY}" "${#1}" "$rc" "$STATUS" >&2
  fi
}
check() { # check <name> <expected status> [expected code]
  if [ "$STATUS" = "$2" ] && { [ -z "${3:-}" ] || [ "$CODE" = "$3" ]; }; then
    PASS=$((PASS+1)); printf "PASS  %-58s %s %s\n" "$1" "$STATUS" "$CODE"
  else
    FAIL=$((FAIL+1)); printf "FAIL  %-58s got %s %s, expected %s %s\n" "$1" "$STATUS" "${CODE:-}" "$2" "${3:-}"
  fi
}
long() { head -c "$1" /dev/zero | tr '\0' 'a'; }
first() { # first <entry text> [first message, default built like the app]
  local msg=${2:-"Journal entry: $1

Emotion labels: None provided"}
  jq -nc --arg t "$1" --arg m "$msg" '{turnNumber: 1, entryText: $t, emotionLabels: [], messages: [{role: "user", content: $m}]}'
}
follow() { # follow <entry id> <follow-up text>, sent for an entry that doesn't exist
  jq -nc --arg id "$1" --arg r "$2" \
    '{entryId: $id, turnNumber: 2, messages: [{role: "user", content: "Journal entry: test"}, {role: "assistant", content: "A reply."}, {role: "user", content: $r}]}'
}

echo "Checking caps on $URL/functions/v1/$FN with throwaway browser $S"
echo

# Seed: one real reflection, so this browser has used today's reflection.
call "$(first "Caps check seed reflection.")"
check "seed reflection (1 Gemini call)" 200
[ "$STATUS" = 200 ] || { echo "Seed failed; can't continue."; exit 1; }

echo
echo "== Reflection text: 600"
call "$(first "$(long 601)")";  check "601 characters: rejected for length" 413 too_long
call "$(first "$(long 600)")";  check "600 characters: passes length, stopped by daily limit" 429

echo
echo "== First message (text plus labels): 1,000"
call "$(first "short" "$(long 1001)")";  check "1,001 characters: rejected for length" 413 too_long
call "$(first "short" "$(long 1000)")";  check "1,000 characters: passes length, stopped by daily limit" 429

echo
echo "== Follow-up: 4,000"
new_id E; call "$(follow "$E" "$(long 4001)")";  check "4,001 characters: rejected for length" 413 too_long
new_id E; call "$(follow "$E" "$(long 4000)")";  check "4,000 characters: passes length, stopped (no such entry)" 404 entry_not_found

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" = 0 ] && echo "Caps confirmed: 600 / 1,000 / 4,000." || echo "Caps NOT confirmed. See the FAIL lines above."
echo
echo "Optional cleanup in the SQL Editor (the seed reflection only):"
echo "  delete from public.conversation_turns where session_id = '$S';"
echo "  delete from public.usage_log where session_id = '$S';"
echo "  delete from public.entries where session_id = '$S';"
[ "$FAIL" = 0 ]
