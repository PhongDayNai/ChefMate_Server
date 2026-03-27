#!/usr/bin/env bash
set -euo pipefail

# Reset DB + seed 20 users + import recipes from VI crawl dataset
# Usage:
#   ./scripts/reset_and_seed_real_data.sh
# Optional env:
#   BASE_URL=http://127.0.0.1:8000 MYSQL_CONTAINER=chefmate-mysql

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-chefmate-mysql}"
SCHEMA_FILE="${SCHEMA_FILE:-./be_db_mysql.sql}"
RECIPES_JSONL="${RECIPES_JSONL:-./data/recipe-crawl-2026-03-vi/import_payload_templates.vi.jsonl}"

if ! command -v jq >/dev/null 2>&1; then
  echo "[ERROR] jq chưa được cài. Hãy cài jq rồi chạy lại." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker chưa có trong máy." >&2
  exit 1
fi

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "[ERROR] Không tìm thấy schema file: $SCHEMA_FILE" >&2
  exit 1
fi

if [ ! -f "$RECIPES_JSONL" ]; then
  echo "[ERROR] Không tìm thấy dataset: $RECIPES_JSONL" >&2
  exit 1
fi

echo "[1/5] Reset database chefmate_db..."

docker exec "$MYSQL_CONTAINER" mysql -uroot -proot -e "DROP DATABASE IF EXISTS chefmate_db;"

docker exec -i "$MYSQL_CONTAINER" mysql -uroot -proot < "$SCHEMA_FILE"

echo "[OK] Database đã được tạo lại từ $SCHEMA_FILE"

echo "[2/5] Chờ API sẵn sàng tại $BASE_URL ..."
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/users/all" || true)
  if [ "$code" = "200" ]; then
    echo "[OK] API ready"
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "[ERROR] API chưa sẵn sàng (last http=$code)" >&2
    exit 1
  fi
done

echo "[3/5] Tạo 20 user Việt Nam qua API /api/users/register ..."

read -r -d '' USERS_JSON <<'JSON' || true
[
  {"fullName":"Nguyễn Minh Tuấn","phone":"0901000001","email":"nguyen.minh.tuan01@gmail.com","password":"123456"},
  {"fullName":"Trần Thu Hà","phone":"0901000002","email":"tran.thu.ha02@gmail.com","password":"123456"},
  {"fullName":"Lê Hoàng Nam","phone":"0901000003","email":"le.hoang.nam03@gmail.com","password":"123456"},
  {"fullName":"Phạm Quỳnh Anh","phone":"0901000004","email":"pham.quynh.anh04@gmail.com","password":"123456"},
  {"fullName":"Đỗ Gia Bảo","phone":"0901000005","email":"do.gia.bao05@gmail.com","password":"123456"},
  {"fullName":"Dương Hùng Phong","phone":"0855576569","email":"dhphong266@gmail.com","password":"123456"},
  {"fullName":"Vũ Khánh Linh","phone":"0901000007","email":"vu.khanh.linh07@gmail.com","password":"123456"},
  {"fullName":"Hoàng Đức Anh","phone":"0901000008","email":"hoang.duc.anh08@gmail.com","password":"123456"},
  {"fullName":"Bùi Ngọc Mai","phone":"0901000009","email":"bui.ngoc.mai09@gmail.com","password":"123456"},
  {"fullName":"Ngô Quốc Huy","phone":"0901000010","email":"ngo.quoc.huy10@gmail.com","password":"123456"},
  {"fullName":"Phan Thanh Tâm","phone":"0901000011","email":"phan.thanh.tam11@gmail.com","password":"123456"},
  {"fullName":"Đặng Bảo Ngọc","phone":"0901000012","email":"dang.bao.ngoc12@gmail.com","password":"123456"},
  {"fullName":"Mai Trung Kiên","phone":"0901000013","email":"mai.trung.kien13@gmail.com","password":"123456"},
  {"fullName":"Lý Hồng Nhung","phone":"0901000014","email":"ly.hong.nhung14@gmail.com","password":"123456"},
  {"fullName":"Tạ Quang Vinh","phone":"0901000015","email":"ta.quang.vinh15@gmail.com","password":"123456"},
  {"fullName":"Đinh Mỹ Duyên","phone":"0901000016","email":"dinh.my.duyen16@gmail.com","password":"123456"},
  {"fullName":"Hồ Anh Khoa","phone":"0901000017","email":"ho.anh.khoa17@gmail.com","password":"123456"},
  {"fullName":"Trương Thanh Trúc","phone":"0901000018","email":"truong.thanh.truc18@gmail.com","password":"123456"},
  {"fullName":"Lâm Nhật Minh","phone":"0901000019","email":"lam.nhat.minh19@gmail.com","password":"123456"},
  {"fullName":"Phùng Hải Yến","phone":"0901000020","email":"phung.hai.yen20@gmail.com","password":"123456"}
]
JSON

idx=0
while IFS= read -r u; do
  idx=$((idx+1))
  fullName=$(echo "$u" | jq -r '.fullName')
  phone=$(echo "$u" | jq -r '.phone')
  email=$(echo "$u" | jq -r '.email')
  password=$(echo "$u" | jq -r '.password')

  payload=$(jq -cn \
    --arg fullName "$fullName" \
    --arg phone "$phone" \
    --arg email "$email" \
    --arg password "$password" \
    '{fullName:$fullName,phone:$phone,email:$email,password:$password}')

  resp=$(curl -sS -w "\nHTTP_STATUS:%{http_code}" \
    -X POST "$BASE_URL/api/users/register" \
    -H "Content-Type: application/json" \
    -d "$payload")

  body="${resp%HTTP_STATUS:*}"
  code="${resp##*HTTP_STATUS:}"

  if [ "$code" != "201" ]; then
    echo "[ERROR] Tạo user #$idx thất bại (http=$code): $body" >&2
    exit 1
  fi

  userId=$(echo "$body" | jq -r '.data.userId')
  echo "  - #$idx => userId=$userId, $fullName"
done < <(echo "$USERS_JSON" | jq -c '.[]')

usersCheck=$(curl -sS "$BASE_URL/api/users/all")
userCount=$(echo "$usersCheck" | jq -r '.data | length')

if [ "$userCount" != "20" ]; then
  echo "[ERROR] Sau seed, số user != 20 (actual=$userCount)" >&2
  exit 1
fi

u6_name=$(echo "$usersCheck" | jq -r '.data[] | select(.userId==6) | .fullName')
u6_email=$(echo "$usersCheck" | jq -r '.data[] | select(.userId==6) | .email')
u6_phone=$(echo "$usersCheck" | jq -r '.data[] | select(.userId==6) | .phone')

if [ "$u6_name" != "Dương Hùng Phong" ] || [ "$u6_email" != "dhphong266@gmail.com" ] || [ "$u6_phone" != "0855576569" ]; then
  echo "[ERROR] userId=6 không khớp yêu cầu. Actual: name='$u6_name', email='$u6_email', phone='$u6_phone'" >&2
  exit 1
fi

echo "[OK] Đã có đủ 20 user, userId=6 đúng theo yêu cầu."

echo "[4/5] Import toàn bộ công thức từ $RECIPES_JSONL ..."

imported=0
failed=0
lineNo=0

while IFS= read -r line || [ -n "$line" ]; do
  lineNo=$((lineNo+1))
  [ -z "$line" ] && continue

  recipeName=$(echo "$line" | jq -r '.recipeName')
  cookingTime=$(echo "$line" | jq -r '.cookingTime')
  ration=$(echo "$line" | jq -r '.ration')
  image=$(echo "$line" | jq -r '.image')
  ingredients=$(echo "$line" | jq -c '.ingredients')
  cookingSteps=$(echo "$line" | jq -c '.cookingSteps')
  tags=$(echo "$line" | jq -c '.tags')

  if [ ! -f "$image" ]; then
    echo "[WARN] Dòng $lineNo: thiếu file ảnh => $image, bỏ qua"
    failed=$((failed+1))
    continue
  fi

  userId=$(( ((lineNo - 1) % 20) + 1 ))

  resp=$(curl -sS -w "\nHTTP_STATUS:%{http_code}" \
    -X POST "$BASE_URL/api/recipes/create" \
    -F "image=@${image}" \
    --form-string "recipeName=${recipeName}" \
    --form-string "cookingTime=${cookingTime}" \
    --form-string "ration=${ration}" \
    --form-string "userId=${userId}" \
    --form-string "ingredients=${ingredients}" \
    --form-string "cookingSteps=${cookingSteps}" \
    --form-string "tags=${tags}")

  body="${resp%HTTP_STATUS:*}"
  code="${resp##*HTTP_STATUS:}"

  if [ "$code" = "201" ]; then
    imported=$((imported+1))
  else
    failed=$((failed+1))
    shortBody=$(echo "$body" | tr '\n' ' ' | head -c 220)
    echo "[WARN] Import fail line=$lineNo http=$code userId=$userId name='$recipeName' body='$shortBody'"
  fi

  if (( lineNo % 100 == 0 )); then
    echo "  ... processed=$lineNo imported=$imported failed=$failed"
  fi
done < "$RECIPES_JSONL"

echo "[5/5] Hoàn tất"
echo "  - Processed lines: $lineNo"
echo "  - Imported recipes: $imported"
echo "  - Failed recipes: $failed"

echo "DONE"
