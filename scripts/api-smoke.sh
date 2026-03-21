#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PHONE="09$(date +%s | tail -c 9)"
EMAIL="chefmate.$(date +%s)@example.com"
PASSWORD="123456"

PNG_FILE="$TMP_DIR/test.png"
printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn7K3sAAAAASUVORK5CYII=' | base64 -d > "$PNG_FILE"

LAST_BODY=""

print_step() {
  echo
  echo "===== $1 ====="
}

request_json() {
  local method="$1"
  local url="$2"
  local payload="${3:-}"
  local expected="${4:-200}"

  local body_file="$TMP_DIR/body.json"
  local code

  if [[ -n "$payload" ]]; then
    code=$(curl -sS -X "$method" "$url" -H 'Content-Type: application/json' -d "$payload" -o "$body_file" -w '%{http_code}')
  else
    code=$(curl -sS -X "$method" "$url" -o "$body_file" -w '%{http_code}')
  fi

  LAST_BODY="$(cat "$body_file")"
  echo "HTTP $code"
  echo "$LAST_BODY"

  if [[ "$code" != "$expected" ]]; then
    echo "❌ Expected HTTP $expected but got $code"
    exit 1
  fi
}

json_get() {
  local expr="$1"
  printf '%s' "$LAST_BODY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const v=(function(){return ${expr}})();if(v===undefined||v===null){process.exit(2)};if(typeof v==='object'){console.log(JSON.stringify(v));}else{console.log(v);}})"
}

assert_success_true() {
  local success
  success=$(json_get 'j.success') || {
    echo "❌ Missing success field"
    exit 1
  }
  if [[ "$success" != "true" ]]; then
    echo "❌ success != true"
    exit 1
  fi
}

print_step "GET /api/users/all"
request_json GET "$BASE_URL/api/users/all" "" 200
assert_success_true

print_step "POST /api/users/register"
request_json POST "$BASE_URL/api/users/register" "{\"phone\":\"$PHONE\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"fullName\":\"ChefMate Smoke\"}" 201
assert_success_true
USER_ID=$(json_get 'j.data.userId')

echo "userId=$USER_ID"

print_step "POST /api/users/login"
request_json POST "$BASE_URL/api/users/login" "{\"identifier\":\"$PHONE\",\"password\":\"$PASSWORD\"}" 200
assert_success_true

print_step "POST /api/recipes/create (multipart)"
BODY_FILE="$TMP_DIR/create.json"
CREATE_CODE=$(curl -sS -X POST "$BASE_URL/api/recipes/create" \
  -F 'recipeName=Smoke Trung Chien' \
  -F 'cookingTime=15m' \
  -F 'ration=2' \
  -F "userId=$USER_ID" \
  -F 'ingredients=[{"ingredientName":"trung ga","weight":2,"unit":"qua"}]' \
  -F 'cookingSteps=[{"content":"dap trung"},{"content":"chien"}]' \
  -F 'tags=[{"tagName":"Bua sang"}]' \
  -F "image=@$PNG_FILE;type=image/png" \
  -o "$BODY_FILE" -w '%{http_code}')
LAST_BODY="$(cat "$BODY_FILE")"
echo "HTTP $CREATE_CODE"
echo "$LAST_BODY"
[[ "$CREATE_CODE" == "201" ]] || { echo "❌ create recipe failed"; exit 1; }
RECIPE_ID=$(printf '%s' "$LAST_BODY" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);if(!j.success)process.exit(2);console.log(j.data);})")

echo "recipeId=$RECIPE_ID"

print_step "GET /api/recipes/all"
request_json GET "$BASE_URL/api/recipes/all" "" 200
assert_success_true

print_step "POST /api/recipes/search"
request_json POST "$BASE_URL/api/recipes/search" "{\"recipeName\":\"trung\",\"userId\":$USER_ID}" 200
assert_success_true

print_step "POST /api/recipes/top-trending"
request_json POST "$BASE_URL/api/recipes/top-trending" "{\"userId\":$USER_ID}" 200
assert_success_true

print_step "GET /api/recipes/tags"
request_json GET "$BASE_URL/api/recipes/tags" "" 200
assert_success_true

print_step "POST /api/recipes/search-by-tag"
request_json POST "$BASE_URL/api/recipes/search-by-tag" "{\"tagName\":\"Bua\",\"userId\":$USER_ID}" 200
assert_success_true

print_step "POST /api/interactions/like"
request_json POST "$BASE_URL/api/interactions/like" "{\"userId\":$USER_ID,\"recipeId\":$RECIPE_ID}" 200
assert_success_true

print_step "POST /api/interactions/increase-view-count"
request_json POST "$BASE_URL/api/interactions/increase-view-count" "{\"recipeId\":$RECIPE_ID}" 200
assert_success_true

print_step "POST /api/interactions/comment"
request_json POST "$BASE_URL/api/interactions/comment" "{\"userId\":$USER_ID,\"recipeId\":$RECIPE_ID,\"content\":\"Mon ngon\"}" 201
assert_success_true

print_step "GET /api/interactions/comments"
request_json GET "$BASE_URL/api/interactions/comments" "" 200
assert_success_true

print_step "GET /api/recipes/growth-report"
request_json GET "$BASE_URL/api/recipes/growth-report" "" 200
assert_success_true

print_step "POST /api/recipes/user-recipes (userId as string)"
request_json POST "$BASE_URL/api/recipes/user-recipes" "{\"userId\":\"$USER_ID\"}" 200
assert_success_true

echo
echo "✅ Smoke test hoàn tất"
