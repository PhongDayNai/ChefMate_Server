#!/usr/bin/env python3
import argparse
import json
import re
import time
from pathlib import Path
from typing import Dict, List, Tuple


UNIT_VI_MAP = {
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

COMMON_FOOD_TERM_MAP = {
    "salt": "muối",
    "pepper": "tiêu",
    "olive oil": "dầu ô liu",
    "oil": "dầu ăn",
    "sugar": "đường",
    "water": "nước",
    "garlic": "tỏi",
    "onion": "hành tây",
    "fish sauce": "nước mắm",
    "soy sauce": "nước tương",
    "butter": "bơ",
    "flour": "bột mì",
    "egg": "trứng",
    "rice": "gạo",
    "chicken": "gà",
    "beef": "bò",
    "pork": "heo",
    "shrimp": "tôm",
}


def normalize_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def vi_time_text(s: str) -> str:
    if not s:
        return "30 phút"
    x = s.strip().lower()
    x = x.replace("mins", "phút").replace("min", "phút")
    x = x.replace("hours", "giờ").replace("hour", "giờ")
    x = x.replace("hrs", "giờ").replace("hr", "giờ")
    # Chuẩn kiểu "1h 30 phút"
    x = re.sub(r"(\d+)h", r"\1 giờ", x)
    x = re.sub(r"\s+", " ", x).strip()
    return x


def collect_texts(data: List[dict]) -> List[str]:
    texts = []
    for r in data:
        if r.get("recipeName"):
            texts.append(str(r["recipeName"]))
        for ing in r.get("ingredients", []):
            if ing.get("ingredientName"):
                texts.append(str(ing["ingredientName"]))
        for st in r.get("cookingSteps", []):
            if st.get("content"):
                texts.append(str(st["content"]))
        for tg in r.get("tags", []):
            if tg.get("tagName"):
                texts.append(str(tg["tagName"]))
    # unique preserving order
    seen = set()
    out = []
    for t in texts:
        t = normalize_spaces(t)
        if not t or t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out


def translate_texts(unique_texts: List[str], batch_size: int = 40, sleep_s: float = 0.15) -> Dict[str, str]:
    from deep_translator import GoogleTranslator

    tr = GoogleTranslator(source="en", target="vi")
    out: Dict[str, str] = {}

    total = len(unique_texts)
    for i in range(0, total, batch_size):
        batch = unique_texts[i : i + batch_size]
        translated = None

        for attempt in range(4):
            try:
                translated = tr.translate_batch(batch)
                break
            except Exception:
                time.sleep((attempt + 1) * 1.2)

        if not translated or len(translated) != len(batch):
            translated = []
            for item in batch:
                ok = None
                for attempt in range(4):
                    try:
                        ok = tr.translate(item)
                        break
                    except Exception:
                        time.sleep((attempt + 1) * 1.0)
                translated.append(ok if ok else item)

        for src, dst in zip(batch, translated):
            out[src] = normalize_spaces(dst if dst else src)

        if (i // batch_size) % 10 == 0:
            print(f"Translated {min(i+batch_size, total)}/{total}")
        time.sleep(sleep_s)

    return out


def post_fix_food_terms(text: str) -> str:
    t = text
    for en, vi in COMMON_FOOD_TERM_MAP.items():
        # thay từ khóa tiếng Anh sót lại nếu có
        t = re.sub(rf"\b{re.escape(en)}\b", vi, t, flags=re.IGNORECASE)
    return normalize_spaces(t)


def transform_dataset(data: List[dict], trans: Dict[str, str], out_dir: Path) -> Tuple[List[dict], int]:
    converted = []
    untranslated_count = 0

    out_images = out_dir / "images"
    out_images.mkdir(parents=True, exist_ok=True)

    for idx, r in enumerate(data, 1):
        nr = dict(r)

        nr["recipeName"] = post_fix_food_terms(trans.get(normalize_spaces(r.get("recipeName", "")), r.get("recipeName", "")))
        nr["cookingTime"] = vi_time_text(r.get("cookingTime", "30 mins"))

        new_ings = []
        for ing in r.get("ingredients", []):
            ni = dict(ing)
            src = normalize_spaces(ing.get("ingredientName", ""))
            ni["ingredientName"] = post_fix_food_terms(trans.get(src, src))
            unit = str(ing.get("unit", "unit")).strip().lower()
            ni["unit"] = UNIT_VI_MAP.get(unit, unit)
            new_ings.append(ni)
        nr["ingredients"] = new_ings

        new_steps = []
        for st in r.get("cookingSteps", []):
            s = normalize_spaces(st.get("content", ""))
            vi = post_fix_food_terms(trans.get(s, s))
            if vi == s and re.search(r"[A-Za-z]", s):
                untranslated_count += 1
            new_steps.append({"content": vi})
        nr["cookingSteps"] = new_steps

        new_tags = []
        for tg in r.get("tags", []):
            t = normalize_spaces(tg.get("tagName", ""))
            vi = post_fix_food_terms(trans.get(t, t))
            new_tags.append({"tagName": vi})
        nr["tags"] = new_tags

        # copy image path => remap into out_dir/images
        src_img = Path(r.get("imagePath", ""))
        if src_img.exists() and src_img.is_file():
            dst_img = out_images / src_img.name
            if not dst_img.exists():
                dst_img.write_bytes(src_img.read_bytes())
            nr["imagePath"] = str(dst_img)
        else:
            nr["imagePath"] = r.get("imagePath", "")

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

        converted.append(nr)

        if idx % 100 == 0:
            print(f"Processed {idx}/{len(data)} recipes")

    return converted, untranslated_count


def main() -> None:
    parser = argparse.ArgumentParser(description="Translate crawled recipes EN -> VI")
    parser.add_argument(
        "--in-json",
        default="/home/dhpho/workspace/projects/chefmate-server/data/recipe-crawl-2026-03/recipes.json",
    )
    parser.add_argument(
        "--out-dir",
        default="/home/dhpho/workspace/projects/chefmate-server/data/recipe-crawl-2026-03-vi",
    )
    args = parser.parse_args()

    in_json = Path(args.in_json)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    data = json.loads(in_json.read_text(encoding="utf-8"))
    print(f"Loaded {len(data)} recipes")

    unique_texts = collect_texts(data)
    print(f"Unique texts to translate: {len(unique_texts)}")

    translations = translate_texts(unique_texts)

    converted, untranslated_count = transform_dataset(data, translations, out_dir)

    (out_dir / "recipes.vi.json").write_text(json.dumps(converted, ensure_ascii=False, indent=2), encoding="utf-8")
    with open(out_dir / "recipes.vi.jsonl", "w", encoding="utf-8") as f:
        for item in converted:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    with open(out_dir / "import_payload_templates.vi.jsonl", "w", encoding="utf-8") as f:
        for item in converted:
            f.write(json.dumps(item["importPayloadTemplate"], ensure_ascii=False) + "\n")

    report = {
        "totalRecipes": len(converted),
        "untranslatedStepCount": untranslated_count,
        "coverage": round(100 * (1 - untranslated_count / max(1, sum(len(r.get("cookingSteps", [])) for r in converted))), 2),
    }
    (out_dir / "translation_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    (out_dir / "README.md").write_text(
        "\n".join(
            [
                "# Recipe Crawl Dataset - Bản tiếng Việt",
                "",
                f"- Tổng công thức: {len(converted)}",
                "- Nguồn gốc: chuyển đổi từ data/recipe-crawl-2026-03",
                "",
                "## File xuất",
                "- `recipes.vi.json`",
                "- `recipes.vi.jsonl`",
                "- `import_payload_templates.vi.jsonl`",
                "- `translation_report.json`",
                "- `images/`",
            ]
        ),
        encoding="utf-8",
    )

    print("DONE")


if __name__ == "__main__":
    main()
