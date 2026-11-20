#!/usr/bin/env bash
# Bezpečnostní smoke test (regrese RLS a autorizace edge funkce).
# Nepotřebuje Docker ani lokální DB – míří na nasazený projekt přes veřejná URL + anon klíč.
# Ověřuje brány, na kterých stojí ochrana dat:
#   1. bez přihlášení nejdou číst dokumenty žáků (RLS)
#   2. bez přihlášení nejdou číst žáci (RLS)
#   3. funkce ai-navrh bez učitelského tokenu vrací 401 (klíč k AI i cizí dokumenty jsou jen pro přihlášené)
#   4. (nepovinné) s učitelským tokenem a vlastními id vrací 200
#
# Použití:
#   SUPABASE_URL=... SUPABASE_ANON_KEY=... bash supabase/tests/security-smoke.sh
# Nepovinně pro test 4:  TEACHER_EMAIL=... TEACHER_PASSWORD=...  (nebo rovnou TEACHER_TOKEN=...)
#                        OWNED_SCHOOL_ID=... OWNED_SUBJECT_ID=...
# URL a anon klíč se, když nejsou v prostředí, načtou z .env.local (obě hodnoty jsou veřejné).
set -u

DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENVF="$DIR/.env.local"
: "${SUPABASE_URL:=$(grep -s '^VITE_SUPABASE_URL=' "$ENVF" | cut -d= -f2-)}"
: "${SUPABASE_ANON_KEY:=$(grep -s '^VITE_SUPABASE_ANON_KEY=' "$ENVF" | cut -d= -f2-)}"
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "Chybí SUPABASE_URL / SUPABASE_ANON_KEY (ani v .env.local)."; exit 2
fi

pass=0; fail=0
check() { # popis  očekávané  skutečné
  if [ "$2" = "$3" ]; then echo "  OK   $1"; pass=$((pass+1));
  else echo "  CHYBA $1 (čekáno '$2', dostal '$3')"; fail=$((fail+1)); fi
}
rows() { python3 -I -c 'import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else "nelist")' 2>/dev/null || echo "nelist"; }

echo "Projekt: $SUPABASE_URL"

echo "[1] anon čte documents -> má být 0"
n=$(curl -s "$SUPABASE_URL/rest/v1/documents?select=id" -H "apikey: $SUPABASE_ANON_KEY" | rows)
check "documents bez přihlášení = 0 řádků" "0" "$n"

echo "[2] anon čte students -> má být 0"
n=$(curl -s "$SUPABASE_URL/rest/v1/students?select=id" -H "apikey: $SUPABASE_ANON_KEY" | rows)
check "students bez přihlášení = 0 řádků" "0" "$n"

echo "[3] ai-navrh bez učitelského tokenu -> 401"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/ai-navrh" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" -d '{"task":"cile","context":{"_ids":{"schoolId":"x"}}}')
check "ai-navrh anon = HTTP 401" "401" "$code"

# [4] nepovinné: s učitelským tokenem vlastní návrh projde (200)
TOKEN="${TEACHER_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -n "${TEACHER_EMAIL:-}" ] && [ -n "${TEACHER_PASSWORD:-}" ]; then
  TOKEN=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
    --data-binary "$(python3 -I -c 'import json,os;print(json.dumps({"email":os.environ["TEACHER_EMAIL"],"password":os.environ["TEACHER_PASSWORD"]}))')" \
    | python3 -I -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))')
fi
if [ -n "$TOKEN" ] && [ -n "${OWNED_SCHOOL_ID:-}" ] && [ -n "${OWNED_SUBJECT_ID:-}" ]; then
  echo "[4] ai-navrh s učitelským tokenem a vlastní školou -> 200"
  body=$(python3 -I -c 'import json,os;print(json.dumps({"task":"cile","context":{"predmet":"test","_ids":{"schoolId":os.environ["OWNED_SCHOOL_ID"],"subjectId":os.environ["OWNED_SUBJECT_ID"],"studentId":None}}}))')
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$SUPABASE_URL/functions/v1/ai-navrh" \
    -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" --data-binary "$body")
  check "ai-navrh přihlášený = HTTP 200" "200" "$code"
else
  echo "[4] přeskočeno (nenastaveno TEACHER_* / OWNED_*)"
fi

echo "Hotovo: $pass OK, $fail chyb."
[ "$fail" -eq 0 ]
