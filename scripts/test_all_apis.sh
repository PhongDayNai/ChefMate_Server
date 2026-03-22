#!/usr/bin/env bash
set -u
BASE="http://127.0.0.1:8000"
TS=$(date +%s)
PHONE="09${TS: -8}"
EMAIL="apitest_${TS}@example.com"
PASS="123456"
NEWPASS="1234567"
FULLNAME="API Test ${TS}"
TOKEN="apitest-${TS}"

log(){ echo -e "\n===== $1 ====="; }
call(){
  NAME="$1"; shift
  RESP=$(curl -sS -w "\nHTTP_STATUS:%{http_code}" "$@")
  BODY="${RESP%HTTP_STATUS:*}"
  CODE="${RESP##*HTTP_STATUS:}"
  echo "[$NAME] STATUS=$CODE"
  echo "$BODY" | head -c 400 | tr '\n' ' '
  echo
}

call "GET users/all" "$BASE/api/users/all"
call "POST users/register" -X POST "$BASE/api/users/register" -H "Content-Type: application/json" -d "{\"fullName\":\"$FULLNAME\",\"phone\":\"$PHONE\",\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"

LOGIN_RESP=$(curl -sS -X POST "$BASE/api/users/login" -H "Content-Type: application/json" -d "{\"identifier\":\"$PHONE\",\"password\":\"$PASS\"}")
USER_ID=$(echo "$LOGIN_RESP" | jq -r '.data.userId // empty')
call "POST users/login" -X POST "$BASE/api/users/login" -H "Content-Type: application/json" -d "{\"identifier\":\"$PHONE\",\"password\":\"$PASS\"}"
[ -z "${USER_ID}" ] && USER_ID=1

call "POST users/change-password" -X POST "$BASE/api/users/change-password" -H "Content-Type: application/json" -d "{\"phone\":\"$PHONE\",\"currentPassword\":\"$PASS\",\"newPassword\":\"$NEWPASS\"}"
call "POST users/forgot-password" -X POST "$BASE/api/users/forgot-password" -H "Content-Type: application/json" -d "{\"phone\":\"$PHONE\"}"
call "POST users/update-user-information" -X POST "$BASE/api/users/update-user-information" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID,\"fullName\":\"$FULLNAME Updated\",\"phone\":\"$PHONE\",\"email\":\"$EMAIL\"}"
call "GET users/recipes-view-history" -X GET "$BASE/api/users/recipes-view-history" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID}"

IMG="/tmp/apitest_${TS}.jpg"
echo "fakeimg" > "$IMG"
ING='[{"ingredientName":"Chicken","weight":200,"unit":"g","isMain":true,"isCommon":false},{"ingredientName":"Garlic","weight":2,"unit":"clove","isMain":false,"isCommon":true}]'
STEPS='[{"content":"Prep ingredients"},{"content":"Cook in pan"}]'
TAGS='[{"tagName":"ApiTest"},{"tagName":"Quick"}]'
call "POST recipes/create" -X POST "$BASE/api/recipes/create" -F "image=@$IMG" -F "recipeName=API Test Recipe $TOKEN" -F "cookingTime=20 mins" -F "ration=2" -F "userId=$USER_ID" -F "ingredients=$ING" -F "cookingSteps=$STEPS" -F "tags=$TAGS"

SEARCH_RESP=$(curl -sS -X POST "$BASE/api/recipes/search" -H "Content-Type: application/json" -d "{\"recipeName\":\"API Test Recipe $TOKEN\",\"userId\":$USER_ID}")
RECIPE_ID=$(echo "$SEARCH_RESP" | jq -r '.data[0].recipeId // .data.recipes[0].recipeId // empty' | head -n1)
[ -z "$RECIPE_ID" ] && RECIPE_ID=1

call "GET recipes/all" "$BASE/api/recipes/all"
call "POST recipes/search" -X POST "$BASE/api/recipes/search" -H "Content-Type: application/json" -d "{\"recipeName\":\"API Test Recipe\",\"userId\":$USER_ID}"
call "GET recipes/ingredients" "$BASE/api/recipes/ingredients"
call "POST recipes/top-trending" -X POST "$BASE/api/recipes/top-trending" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID}"
call "GET recipes/tags" "$BASE/api/recipes/tags"
call "POST recipes/search-by-tag" -X POST "$BASE/api/recipes/search-by-tag" -H "Content-Type: application/json" -d "{\"tagName\":\"ApiTest\",\"userId\":$USER_ID}"
call "POST recipes/user-recipes" -X POST "$BASE/api/recipes/user-recipes" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID}"
call "GET recipes/growth-report" "$BASE/api/recipes/growth-report"

call "POST interactions/like" -X POST "$BASE/api/interactions/like" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID,\"recipeId\":$RECIPE_ID}"
COMMENT_TEXT="Comment $TOKEN"
call "POST interactions/comment" -X POST "$BASE/api/interactions/comment" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID,\"recipeId\":$RECIPE_ID,\"content\":\"$COMMENT_TEXT\"}"
call "POST interactions/increase-view-count" -X POST "$BASE/api/interactions/increase-view-count" -H "Content-Type: application/json" -d "{\"recipeId\":$RECIPE_ID}"
COMMENTS=$(curl -sS "$BASE/api/interactions/comments")
COMMENT_ID=$(echo "$COMMENTS" | jq -r --arg t "$COMMENT_TEXT" '.data[] | select(.content==$t) | .commentId' | head -n1)
[ -z "$COMMENT_ID" ] && COMMENT_ID=$(echo "$COMMENTS" | jq -r '.data[0].commentId // empty')
call "GET interactions/comments" "$BASE/api/interactions/comments"
if [ -n "$COMMENT_ID" ]; then
  call "DELETE interactions/comment" -X DELETE "$BASE/api/interactions/comment" -H "Content-Type: application/json" -d "{\"commentId\":$COMMENT_ID}"
fi

call "GET pantry" "$BASE/api/pantry?userId=$USER_ID"
call "POST pantry/upsert" -X POST "$BASE/api/pantry/upsert" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID,\"ingredientName\":\"Garlic\",\"quantity\":5,\"unit\":\"clove\"}"
PANTRY_ID=$(curl -sS "$BASE/api/pantry?userId=$USER_ID" | jq -r '.data[] | select((.ingredientName|ascii_downcase)=="garlic") | .pantryItemId' | head -n1)
if [ -n "$PANTRY_ID" ]; then
  call "DELETE pantry/delete" -X DELETE "$BASE/api/pantry/delete" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID,\"pantryItemId\":$PANTRY_ID}"
fi

call "POST ai-chat/sessions" -X POST "$BASE/api/ai-chat/sessions" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID,\"title\":\"Session $TOKEN\",\"activeRecipeId\":$RECIPE_ID}"
SESSION_CREATE=$(curl -sS -X POST "$BASE/api/ai-chat/sessions" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID,\"title\":\"Session2 $TOKEN\"}")
SESSION_ID=$(echo "$SESSION_CREATE" | jq -r '.data.chatSessionId // empty')
[ -z "$SESSION_ID" ] && SESSION_ID=1
call "GET ai-chat/sessions/:id" "$BASE/api/ai-chat/sessions/$SESSION_ID?userId=$USER_ID"
call "PATCH ai-chat/sessions/active-recipe" -X PATCH "$BASE/api/ai-chat/sessions/active-recipe" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID,\"chatSessionId\":$SESSION_ID,\"recipeId\":$RECIPE_ID}"
call "POST ai-chat/recommendations-from-pantry" -X POST "$BASE/api/ai-chat/recommendations-from-pantry" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID,\"limit\":10}"
call "POST ai-chat/messages" -X POST "$BASE/api/ai-chat/messages" -H "Content-Type: application/json" -d "{\"userId\":$USER_ID,\"chatSessionId\":$SESSION_ID,\"message\":\"Xin chào AI, gợi ý món giúp tôi\"}"

echo "DONE user=$USER_ID recipe=$RECIPE_ID session=$SESSION_ID"
