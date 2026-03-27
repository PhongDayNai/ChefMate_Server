#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, List


def nspace(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def vi_time_text(s: str) -> str:
    x = (s or "").strip().lower()
    if not x:
        return "30 phút"
    x = x.replace("mins", "phút").replace("min", "phút")
    x = x.replace("hours", "giờ").replace("hour", "giờ")
    x = x.replace("hrs", "giờ").replace("hr", "giờ")
    x = re.sub(r"(\d+)h", r"\1 giờ", x)
    x = nspace(x)
    return x


UNIT_MAP = {
    "g": "g",
    "kg": "kg",
    "ml": "ml",
    "l": "l",
    "tbsp": "muỗng canh",
    "tsp": "muỗng cà phê",
    "cup": "cốc",
    "oz": "oz",
    "lb": "lb",
    "clove": "tép",
    "slice": "lát",
    "piece": "miếng",
    "unit": "đơn vị",
}

# Cố ý rất lớn để đảm bảo Việt hóa tốt nhất có thể theo rule-based
TERM_MAP = {
    "cauliflower": "súp lơ trắng",
    "soup": "súp",
    "banana": "chuối",
    "bread": "bánh mì",
    "hot cross buns": "bánh mì hot cross",
    "whipped": "đánh bông",
    "honey": "mật ong",
    "butter": "bơ",
    "egg": "trứng",
    "eggs": "trứng",
    "onion": "hành tây",
    "spring onion": "hành lá",
    "garlic": "tỏi",
    "ginger": "gừng",
    "chicken": "gà",
    "beef": "bò",
    "pork": "thịt heo",
    "shrimp": "tôm",
    "fish": "cá",
    "rice": "gạo",
    "noodles": "mì",
    "flour": "bột mì",
    "sugar": "đường",
    "salt": "muối",
    "pepper": "tiêu",
    "olive oil": "dầu ô liu",
    "oil": "dầu ăn",
    "water": "nước",
    "soy sauce": "nước tương",
    "fish sauce": "nước mắm",
    "vinegar": "giấm",
    "lemon": "chanh",
    "lime": "chanh xanh",
    "milk": "sữa",
    "cheese": "phô mai",
    "tomato": "cà chua",
    "potato": "khoai tây",
    "carrot": "cà rốt",
    "cabbage": "bắp cải",
    "cucumber": "dưa leo",
    "lettuce": "xà lách",
    "chili": "ớt",
    "chilli": "ớt",
    "stir-fry": "xào",
    "stir fry": "xào",
    "fried": "chiên",
    "fry": "chiên",
    "boil": "luộc",
    "simmer": "đun nhỏ lửa",
    "bake": "nướng",
    "roast": "quay",
    "grill": "nướng vỉ",
    "steam": "hấp",
    "mix": "trộn",
    "chop": "băm",
    "slice": "thái lát",
    "add": "thêm",
    "cook": "nấu",
    "serve": "dùng",
    "minutes": "phút",
    "minute": "phút",
    "hour": "giờ",
    "hours": "giờ",
    "for": "trong",
    "until": "đến khi",
    "and": "và",
    "with": "với",
    "into": "vào",
    "in": "trong",
    "to": "để",
    "the": "",
    "a": "",
    "an": "",
}


def map_text_heuristic(text: str) -> str:
    s = nspace(text)
    if not s:
        return s

    # Giữ nguyên nếu đã có nhiều ký tự tiếng Việt
    if re.search(r"[ăâđêôơưÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]", s):
        return s

    out = s

    # Áp cụm từ dài trước
    for en, vi in sorted(TERM_MAP.items(), key=lambda x: len(x[0]), reverse=True):
        out = re.sub(rf"\b{re.escape(en)}\b", vi, out, flags=re.IGNORECASE)

    # Dọn khoảng trắng dư do bỏ mạo từ
    out = re.sub(r"\s+", " ", out).strip()

    # Viết hoa chữ đầu câu
    if out:
        out = out[0].upper() + out[1:]

    return out


def convert(data: List[Dict[str, Any]], out_dir: Path) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    out_images = out_dir / "images"
    out_images.mkdir(parents=True, exist_ok=True)

    for i, r in enumerate(data, 1):
        nr = dict(r)
        nr["recipeName"] = map_text_heuristic(str(r.get("recipeName", "")))
        nr["cookingTime"] = vi_time_text(str(r.get("cookingTime", "")))

        ings = []
        for ing in r.get("ingredients", []):
            ni = dict(ing)
            ni["ingredientName"] = map_text_heuristic(str(ing.get("ingredientName", "")))
            u = str(ing.get("unit", "unit")).lower().strip()
            ni["unit"] = UNIT_MAP.get(u, map_text_heuristic(u).lower())
            ings.append(ni)
        nr["ingredients"] = ings

        steps = []
        for st in r.get("cookingSteps", []):
            steps.append({"content": map_text_heuristic(str(st.get("content", "")))})
        nr["cookingSteps"] = steps

        tags = []
        for t in r.get("tags", []):
            tags.append({"tagName": map_text_heuristic(str(t.get("tagName", "")))})
        nr["tags"] = tags

        src_img = Path(str(r.get("imagePath", "")))
        if src_img.exists() and src_img.is_file():
            dst_img = out_images / src_img.name
            if not dst_img.exists():
                dst_img.write_bytes(src_img.read_bytes())
            nr["imagePath"] = str(dst_img)

        nr["importPayloadTemplate"] = {
            "recipeName": nr.get("recipeName", ""),
            "cookingTime": nr.get("cookingTime", ""),
            "ration": nr.get("ration", 2),
            "userId": "<SET_USER_ID>",
            "ingredients": nr.get("ingredients", []),
            "cookingSteps": nr.get("cookingSteps", []),
            "tags": nr.get("tags", []),
            "image": nr.get("imagePath", ""),
        }

        out.append(nr)
        if i % 200 == 0:
            print(f"Converted {i}/{len(data)}")

    return out


def english_ratio(text: str) -> float:
    letters = re.findall(r"[A-Za-z]", text)
    if not letters:
        return 0.0
    vi_marks = re.findall(r"[ăâđêôơưÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]", text)
    # càng nhiều dấu Việt -> càng ít English risk
    penalty = min(0.9, len(vi_marks) / max(1, len(text)))
    return max(0.0, 1.0 - penalty)


def qa_report(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    total_steps = 0
    suspicious_steps = 0
    total_ing = 0
    suspicious_ing = 0

    sample_bad_steps = []
    sample_bad_ing = []

    for r in data:
        for st in r.get("cookingSteps", []):
            total_steps += 1
            t = st.get("content", "")
            # còn chuỗi tiếng Anh rõ rệt
            if re.search(r"\b(the|and|with|into|until|stir|cook|bake|fry|boil|serve)\b", t, flags=re.IGNORECASE):
                suspicious_steps += 1
                if len(sample_bad_steps) < 10:
                    sample_bad_steps.append(t)

        for ing in r.get("ingredients", []):
            total_ing += 1
            t = ing.get("ingredientName", "")
            if re.search(r"\b(chicken|beef|pork|onion|garlic|oil|sugar|salt|pepper|flour|rice|noodle)\b", t, flags=re.IGNORECASE):
                suspicious_ing += 1
                if len(sample_bad_ing) < 10:
                    sample_bad_ing.append(t)

    return {
        "totalRecipes": len(data),
        "totalSteps": total_steps,
        "suspiciousEnglishSteps": suspicious_steps,
        "stepVietnameseCoveragePercent": round(100 * (1 - suspicious_steps / max(1, total_steps)), 2),
        "totalIngredients": total_ing,
        "suspiciousEnglishIngredients": suspicious_ing,
        "ingredientVietnameseCoveragePercent": round(100 * (1 - suspicious_ing / max(1, total_ing)), 2),
        "sampleBadSteps": sample_bad_steps,
        "sampleBadIngredients": sample_bad_ing,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-json", required=True)
    ap.add_argument("--out-dir", required=True)
    args = ap.parse_args()

    in_json = Path(args.in_json)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    data = json.loads(in_json.read_text(encoding="utf-8"))
    print(f"Loaded {len(data)} recipes")

    vi_data = convert(data, out_dir)

    (out_dir / "recipes.vi.json").write_text(json.dumps(vi_data, ensure_ascii=False, indent=2), encoding="utf-8")
    with open(out_dir / "recipes.vi.jsonl", "w", encoding="utf-8") as f:
        for x in vi_data:
            f.write(json.dumps(x, ensure_ascii=False) + "\n")

    with open(out_dir / "import_payload_templates.vi.jsonl", "w", encoding="utf-8") as f:
        for x in vi_data:
            f.write(json.dumps(x["importPayloadTemplate"], ensure_ascii=False) + "\n")

    report = qa_report(vi_data)
    (out_dir / "translation_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    (out_dir / "README.md").write_text(
        "\n".join(
            [
                "# Recipe Crawl Dataset - Vietnamese (Rule-based)",
                "",
                f"- Total recipes: {len(vi_data)}",
                "- Method: deterministic rule-based translation + QA coverage report",
                "",
                "Files:",
                "- recipes.vi.json",
                "- recipes.vi.jsonl",
                "- import_payload_templates.vi.jsonl",
                "- translation_report.json",
                "- images/",
            ]
        ),
        encoding="utf-8",
    )

    print("DONE")


if __name__ == "__main__":
    main()
