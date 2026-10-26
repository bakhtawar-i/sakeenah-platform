#!/usr/bin/env bash
# Offline self-test for the ID and header handling in test-limits.sh and caps-check.sh.
# Sends nothing anywhere. Needs bash and jq; works in Git Bash on Windows.
#
#   ./selftest.sh
#
# It reproduces the Git Bash problem: uuidgen missing and `openssl rand -hex 16` printing \r\n,
# plus a key, email and password pasted with \r\n. It checks that every generated ID comes out
# clean, then runs both scripts end to end with a fake curl that records any header containing
# \r or \n (the cause of curl: (43) and HTTP 000 on Windows) and answers as if the server were
# unreachable.
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); printf 'PASS  %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL  %s\n' "$1"; [ -n "${2:-}" ] && printf '      %s\n' "$2"; }
has_cr_lf() { case "$1" in *$'\r'*|*$'\n'*) return 0 ;; esac; return 1; }

for tool in jq; do command -v "$tool" >/dev/null 2>&1 || { echo "ERROR: $tool is not installed." >&2; exit 2; }; done

SHIMS=$(mktemp -d); trap 'rm -rf "$SHIMS"' EXIT
# shim <dir> <name> <printf format>: a fake tool that prints exactly that (empty format: prints nothing, fails).
shim() {
  mkdir -p "$1"
  if [ -n "$3" ]; then printf '#!/bin/sh\nprintf "%s"\n' "$3" > "$1/$2"; else printf '#!/bin/sh\nexit 1\n' > "$1/$2"; fi
  chmod +x "$1/$2"
}
shim "$SHIMS/uuidgen-crlf" uuidgen 'ABCDEF01-2345-6789-ABCD-EF0123456789\r\n'
shim "$SHIMS/openssl-crlf" uuidgen ''
# Like Git Bash's openssl: a different 32-hex value each time, ending in \r\n.
mkdir -p "$SHIMS/openssl-crlf"
printf '#!/usr/bin/env bash\nprintf "%%04x%%04x%%04x%%04x%%04x%%04x%%04x%%04x\\r\\n" $RANDOM $RANDOM $RANDOM $RANDOM $RANDOM $RANDOM $RANDOM $RANDOM\n' > "$SHIMS/openssl-crlf/openssl"
chmod +x "$SHIMS/openssl-crlf/openssl"
shim "$SHIMS/neither" uuidgen ''
shim "$SHIMS/neither" openssl ''

# A fake curl: logs every call, and every -H value containing \r or \n; prints the status the
# scripts ask for as 000 and exits 7 (could not connect), like an unreachable server.
cat > "$SHIMS/openssl-crlf/curl" <<'EOF'
#!/usr/bin/env bash
echo CALL >> "$CURL_LOG"
prev=""; w=""
for a in "$@"; do
  if [ "$prev" = "-H" ]; then case "$a" in *$'\r'*|*$'\n'*) printf 'LINEBREAK %q\n' "${a%%:*}" >> "$CURL_LOG" ;; esac; fi
  [ "$prev" = "-w" ] && w=$a
  prev=$a
done
[ "$w" = "%{http_code}" ] && printf 000 || printf '000 0.000'
exit 7
EOF
chmod +x "$SHIMS/openssl-crlf/curl"

for script in test-limits caps-check; do
  F="$HERE/$script.sh"
  FUNCS=$(sed -n -e '/^clean() {/p' -e '/^valid_id() {/p' -e '/^rand_id() {/,/^}/p' "$F")
  echo "== $script.sh"

  # rand_id with each generator. The fakes come first on PATH; a failing fake stands in for a missing tool.
  for case in uuidgen-crlf openssl-crlf neither; do
    id=$(PATH="$SHIMS/$case:$PATH" bash -c "$FUNCS"$'\nrand_id')
    if [ -n "$id" ] && ! has_cr_lf "$id" && [[ "$id" =~ ^[A-Za-z0-9-]+$ ]]; then
      ok "rand_id, $case: clean ID ($id)"
    else
      bad "rand_id, $case: bad ID" "$(printf '%s' "$id" | od -c | head -2 | tr -s ' ')"
    fi
  done

  # clean and valid_id directly.
  got=$(bash -c "$FUNCS"$'\nclean "$1"' _ $'key-123\r\n')
  [ "$got" = "key-123" ] && ok "clean removes \\r\\n from a pasted value" || bad "clean left: $(printf '%s' "$got" | od -c | head -1)"
  for v in $'abc\r' $'abc\n' '' 'a b' 'a;b'; do
    bash -c "$FUNCS"$'\nvalid_id "$1"' _ "$v" && bad "valid_id accepted $(printf '%q' "$v")" || ok "valid_id rejects $(printf '%q' "$v")"
  done
  bash -c "$FUNCS"$'\nvalid_id "$1"' _ "test-0123abcd-ef" && ok "valid_id accepts test-0123abcd-ef" || bad "valid_id rejected a good ID"

  # End to end: uuidgen missing, openssl printing \r\n, key/email/password pasted with \r\n, DEBUG on.
  export CURL_LOG="$SHIMS/curl-$script.log"; : > "$CURL_LOG"
  out=$(PATH="$SHIMS/openssl-crlf:$PATH" SUPABASE_URL=http://unreachable.invalid FN=sakeena-reflect-v2-test \
    ANON_KEY=$'stub-key\r\n' TEST_EMAIL=$'throwaway@example.com\r\n' TEST_PASSWORD=$'pw\r\n' DEBUG=1 bash "$F" 2>&1)
  calls=$(grep -c '^CALL' "$CURL_LOG"); breaks=$(grep '^LINEBREAK' "$CURL_LOG" | sort -u | tr '\n' ' ')
  [ "$calls" -ge 1 ] && ok "end to end: the script got as far as calling curl" || bad "end to end: curl was never called" "$(printf '%s\n' "$out" | tail -2)"
  [ -z "$breaks" ] && ok "end to end: no header value contains \\r or \\n" || bad "end to end: header with a line break: $breaks"
  dbg=$(printf '%s\n' "$out" | grep -m1 '^DEBUG #1 ')
  case "$dbg" in *"valid: yes"*) ok "end to end: DEBUG shows a valid browser ID" ;; *) bad "end to end: no valid DEBUG line" "${dbg:-$(printf '%s\n' "$out" | tail -2)}" ;; esac
  has_cr_lf "$dbg" && bad "end to end: DEBUG line contains a line break" || ok "end to end: DEBUG line is clean"
  [ "$calls" = 1 ] && ok "end to end: stopped after the first failed request" || bad "end to end: sent $calls requests after a failed first request"
done

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" = 0 ]
