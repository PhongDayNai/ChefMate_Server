#!/usr/bin/env python3
import argparse
import concurrent.futures as cf
import json
import os
import random
import re
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

SITEMAP_INDEX = "https://www.bbcgoodfood.com/sitemap.xml"
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
COMMON_INGREDIENTS = {
    "salt",
    "pepper",
    "oil",
    "olive oil",
    "sugar",
    "water",
    "garlic",
    "onion",
    "soy sauce",
    "fish sauce",
    "vinegar",
    "butter",
    "flour",
}
UNIT_ALIASES = {
    "g": "g",
    "gram": "g",
    "grams": "g",
    "kg": "kg",
    "ml": "ml",
    "l": "l",
    "tbsp": "tbsp",
    "tablespoon": "tbsp",
    "tablespoons": "tbsp",
    "tsp": "tsp",
    "teaspoon": "tsp",
    "teaspoons": "tsp",
    "cup": "cup",
    "cups": "cup",
    "oz": "oz",
    "lb": "lb",
    "clove": "clove",
    "cloves": "clove",
    "slice": "slice",
    "slices": "slice",
    "piece": "piece",
    "pieces": "piece",
}


session = requests.Session()
session.headers.update(
    {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
)


def req(url: str, timeout: int = 30, retries: int = 3) -> Optional[requests.Response]:
    for i in range(retries):
        try:
            r = session.get(url, timeout=timeout)
            if r.status_code == 200:
                return r
            if r.status_code in {429, 500, 502, 503, 504}:
                time.sleep(1.2 * (i + 1))
                continue
            return None
        except requests.RequestException:
            time.sleep(1.2 * (i + 1))
    return None


def parse_duration_to_mins(duration: str) -> Optional[int]:
    if not duration:
        return None
    # ISO 8601 duration, e.g. PT1H30M
    m = re.match(r"P(?:\d+D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?", duration)
    if not m:
        return None
    h = int(m.group(1) or 0)
    mm = int(m.group(2) or 0)
    ss = int(m.group(3) or 0)
    total = h * 60 + mm + (1 if ss else 0)
    return total if total > 0 else None


def normalize_time(total_mins: Optional[int], fallback_text: str = "") -> str:
    if total_mins and total_mins > 0:
        if total_mins >= 60:
            h = total_mins // 60
            m = total_mins % 60
            if m:
                return f"{h}h {m} mins"
            return f"{h}h"
        return f"{total_mins} mins"
    fb = (fallback_text or "").strip()
    return fb if fb else "30 mins"


def extract_number(value: str, default: int = 2) -> int:
    if not value:
        return default
    m = re.search(r"\d+(?:\.\d+)?", value)
    if not m:
        return default
    try:
        return max(1, int(float(m.group(0))))
    except Exception:
        return default


def parse_ingredient(line: str, idx: int) -> Dict[str, Any]:
    s = (line or "").strip()
    # Example: "2 tbsp olive oil"
    # Captures quantity + unit + name
    m = re.match(
        r"^\s*(\d+(?:[\./]\d+)?)\s*([A-Za-z]+)?\s+(.*)$",
        s,
    )
    weight: Any = 1
    unit = "unit"
    ingredient_name = s if s else f"Ingredient {idx + 1}"

    if m:
        qty_raw = m.group(1)
        unit_raw = (m.group(2) or "").lower()
        rest = (m.group(3) or "").strip(",; ")
        try:
            if "/" in qty_raw:
                n, d = qty_raw.split("/", 1)
                weight = round(float(n) / float(d), 2)
            else:
                weight = float(qty_raw)
                if float(weight).is_integer():
                    weight = int(weight)
        except Exception:
            weight = 1

        unit = UNIT_ALIASES.get(unit_raw, unit_raw if unit_raw else "unit")
        ingredient_name = rest if rest else ingredient_name

    name_lower = ingredient_name.lower()
    is_common = any(c in name_lower for c in COMMON_INGREDIENTS)

    return {
        "ingredientName": ingredient_name[:120],
        "weight": weight,
        "unit": unit[:30],
        "isMain": idx < 3,
        "isCommon": bool(is_common),
    }


def flatten_instructions(instr: Any) -> List[str]:
    out: List[str] = []
    if isinstance(instr, list):
        for item in instr:
            if isinstance(item, str):
                t = item.strip()
                if t:
                    out.append(t)
            elif isinstance(item, dict):
                if "text" in item and isinstance(item["text"], str):
                    t = item["text"].strip()
                    if t:
                        out.append(t)
                elif "itemListElement" in item:
                    out.extend(flatten_instructions(item["itemListElement"]))
    elif isinstance(instr, str):
        t = instr.strip()
        if t:
            out.append(t)
    elif isinstance(instr, dict):
        if "text" in instr and isinstance(instr["text"], str):
            t = instr["text"].strip()
            if t:
                out.append(t)
        elif "itemListElement" in instr:
            out.extend(flatten_instructions(instr["itemListElement"]))
    return out


def find_recipe_obj(obj: Any) -> Optional[Dict[str, Any]]:
    if isinstance(obj, dict):
        t = obj.get("@type")
        if t == "Recipe" or (isinstance(t, list) and "Recipe" in t):
            return obj
        for v in obj.values():
            r = find_recipe_obj(v)
            if r:
                return r
    elif isinstance(obj, list):
        for item in obj:
            r = find_recipe_obj(item)
            if r:
                return r
    return None


def extract_json_ld_recipe(html: str) -> Optional[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    for s in scripts:
        txt = (s.string or s.get_text() or "").strip()
        if not txt:
            continue
        try:
            data = json.loads(txt)
        except Exception:
            continue
        recipe = find_recipe_obj(data)
        if recipe:
            return recipe
    return None


def choose_image_url(img_field: Any) -> Optional[str]:
    if isinstance(img_field, str):
        return img_field
    if isinstance(img_field, list) and img_field:
        first = img_field[0]
        if isinstance(first, str):
            return first
        if isinstance(first, dict):
            return first.get("url")
    if isinstance(img_field, dict):
        return img_field.get("url")
    return None


def ext_from_content_type(ct: str) -> str:
    ct = (ct or "").lower()
    if "png" in ct:
        return ".png"
    if "webp" in ct:
        return ".webp"
    if "gif" in ct:
        return ".gif"
    return ".jpg"


def download_image(image_url: str, image_path_no_ext: Path) -> Optional[Path]:
    r = req(image_url, timeout=45, retries=2)
    if not r:
        return None
    ext = ext_from_content_type(r.headers.get("content-type", ""))
    out = image_path_no_ext.with_suffix(ext)
    try:
        with open(out, "wb") as f:
            f.write(r.content)
        if out.stat().st_size < 1024:
            out.unlink(missing_ok=True)
            return None
        return out
    except Exception:
        return None


def list_recipe_urls(target: int, extra_buffer: int = 300) -> List[str]:
    idx = req(SITEMAP_INDEX, timeout=30)
    if not idx:
        raise RuntimeError("Cannot fetch sitemap index")
    root = ET.fromstring(idx.content)
    sm_urls = [e.text for e in root.findall(".//s:loc", NS) if e.text and e.text.endswith("-recipe.xml")]
    sm_urls.sort(reverse=True)

    urls: List[str] = []
    want = target + extra_buffer
    for sm in sm_urls:
        r = req(sm, timeout=30)
        if not r:
            continue
        try:
            rr = ET.fromstring(r.content)
        except Exception:
            continue
        part = [e.text for e in rr.findall(".//s:loc", NS) if e.text]
        random.shuffle(part)
        urls.extend(part)
        if len(urls) >= want:
            break

    # unique preserve order
    seen = set()
    out = []
    for u in urls:
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def process_recipe(url: str, index: int, images_dir: Path) -> Optional[Dict[str, Any]]:
    r = req(url, timeout=35, retries=2)
    if not r:
        return None

    recipe = extract_json_ld_recipe(r.text)
    if not recipe:
        return None

    recipe_name = (recipe.get("name") or "").strip()
    if not recipe_name:
        return None

    total_mins = parse_duration_to_mins(recipe.get("totalTime", ""))
    cooking_time = normalize_time(total_mins)

    ration = extract_number(str(recipe.get("recipeYield", "") or ""), default=2)

    raw_ings = recipe.get("recipeIngredient")
    if not isinstance(raw_ings, list) or len(raw_ings) == 0:
        return None
    ingredients = [parse_ingredient(str(x), i) for i, x in enumerate(raw_ings[:40])]

    raw_steps = flatten_instructions(recipe.get("recipeInstructions"))
    if not raw_steps:
        return None
    cooking_steps = [{"content": s[:1200]} for s in raw_steps[:30]]

    # tags from keywords + category + cuisine
    tags_set = set()
    kws = recipe.get("keywords")
    if isinstance(kws, str):
        for t in re.split(r"[,;|]", kws):
            tt = t.strip()
            if tt:
                tags_set.add(tt)
    elif isinstance(kws, list):
        for t in kws:
            if isinstance(t, str) and t.strip():
                tags_set.add(t.strip())

    for k in ["recipeCategory", "recipeCuisine"]:
        v = recipe.get(k)
        if isinstance(v, str) and v.strip():
            tags_set.add(v.strip())
        elif isinstance(v, list):
            for t in v:
                if isinstance(t, str) and t.strip():
                    tags_set.add(t.strip())

    tags = [{"tagName": t[:60]} for t in sorted(tags_set)[:12]]

    image_url = choose_image_url(recipe.get("image"))
    if not image_url:
        return None

    img_path = download_image(image_url, images_dir / f"recipe_{index:05d}")
    if not img_path:
        return None

    return {
        "source": "bbcgoodfood",
        "sourceUrl": url,
        "recipeName": recipe_name[:200],
        "cookingTime": cooking_time,
        "ration": ration,
        "ingredients": ingredients,
        "cookingSteps": cooking_steps,
        "tags": tags,
        "imagePath": str(img_path),
        "imageSourceUrl": image_url,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl BBC Good Food recipes to ChefMate schema")
    parser.add_argument("--target", type=int, default=1000)
    parser.add_argument(
        "--out-dir",
        type=str,
        default="/home/dhpho/workspace/projects/chefmate-server/data/recipe-crawl-2026-03",
    )
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    images_dir = out_dir / "images"
    out_dir.mkdir(parents=True, exist_ok=True)
    images_dir.mkdir(parents=True, exist_ok=True)

    urls = list_recipe_urls(args.target)
    random.shuffle(urls)

    dataset: List[Dict[str, Any]] = []
    started = time.time()

    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = []
        idx = 1
        for u in urls:
            futs.append(ex.submit(process_recipe, u, idx, images_dir))
            idx += 1
            if idx > args.target + 300:
                break

        for f in cf.as_completed(futs):
            rec = f.result()
            if rec:
                dataset.append(rec)
                if len(dataset) % 50 == 0:
                    print(f"Collected {len(dataset)} recipes...")
            if len(dataset) >= args.target:
                break

    # keep exact target
    dataset = dataset[: args.target]

    # rewrite images index sequentially for final set
    final: List[Dict[str, Any]] = []
    for i, rec in enumerate(dataset, 1):
        old = Path(rec["imagePath"])
        ext = old.suffix.lower() if old.suffix else ".jpg"
        new = images_dir / f"recipe_{i:05d}{ext}"
        if old != new and old.exists():
            old.rename(new)
        rec["imagePath"] = str(new)

        # Pre-build import payload skeleton (without userId fixed)
        rec["importPayloadTemplate"] = {
            "recipeName": rec["recipeName"],
            "cookingTime": rec["cookingTime"],
            "ration": rec["ration"],
            "userId": "<SET_USER_ID>",
            "ingredients": rec["ingredients"],
            "cookingSteps": rec["cookingSteps"],
            "tags": rec.get("tags", []),
            "image": rec["imagePath"],
        }
        final.append(rec)

    json_path = out_dir / "recipes.json"
    jsonl_path = out_dir / "recipes.jsonl"
    payloads_jsonl = out_dir / "import_payload_templates.jsonl"

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=2)

    with open(jsonl_path, "w", encoding="utf-8") as f:
        for item in final:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    with open(payloads_jsonl, "w", encoding="utf-8") as f:
        for item in final:
            f.write(json.dumps(item["importPayloadTemplate"], ensure_ascii=False) + "\n")

    readme = out_dir / "README.md"
    elapsed = int(time.time() - started)
    readme.write_text(
        "\n".join(
            [
                "# Recipe Crawl Dataset (BBC Good Food)",
                "",
                f"- Target: {args.target}",
                f"- Collected: {len(final)}",
                f"- Elapsed: ~{elapsed}s",
                "",
                "## Files",
                "- `recipes.json`: full normalized dataset",
                "- `recipes.jsonl`: JSONL per recipe",
                "- `import_payload_templates.jsonl`: payload template ready for API mapping",
                "- `images/`: downloaded recipe images",
                "",
                "## API Mapping Notes",
                "Use each object in `importPayloadTemplate` with multipart/form-data:",
                "- Keep `ingredients`, `cookingSteps`, `tags` as JSON-string fields",
                "- Replace `userId` placeholder before sending",
                "- Upload `image` from local file path",
            ]
        ),
        encoding="utf-8",
    )

    print(f"DONE. Collected {len(final)} recipes -> {out_dir}")


if __name__ == "__main__":
    main()
