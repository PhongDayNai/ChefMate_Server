#!/usr/bin/env python3
import argparse
import json
import re
import time
from pathlib import Path
from typing import Dict, List
from urllib.parse import quote

import requests


def nspace(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def gtranslate_en_vi(text: str, timeout: int = 20) -> str:
    q = quote(text)
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q={q}"
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    if isinstance(data, list) and data and isinstance(data[0], list):
        out = []
        for seg in data[0]:
            if isinstance(seg, list) and seg:
                out.append(seg[0])
        merged = "".join(out).strip()
        return merged if merged else text
    return text


def collect_unique_texts(data: List[dict]) -> List[str]:
    out = []
    seen = set()

    def add(x: str):
        t = nspace(str(x))
        if t and t not in seen:
            seen.add(t)
            out.append(t)

    for r in data:
        add(r.get("recipeName", ""))
        for ing in r.get("ingredients", []):
            add(ing.get("ingredientName", ""))
        for st in r.get("cookingSteps", []):
            add(st.get("content", ""))
        for tg in r.get("tags", []):
            add(tg.get("tagName", ""))

    return out


def fix_domain_vi(text: str) -> str:
    t = nspace(text)
    # Vá các lỗi dịch hay gặp trong ngữ cảnh nấu ăn
    t = re.sub(r"\bđánh răng\b", "phết mặt", t, flags=re.IGNORECASE)
    t = re.sub(r"\bsúp súp lơ\b", "súp lơ", t, flags=re.IGNORECASE)
    t = re.sub(r"\btrong (\d+) phút\b", r"trong \1 phút", t, flags=re.IGNORECASE)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def vi_time(s: str) -> str:
    x = nspace(s).lower()
    if not x:
        return "30 phút"
    x = x.replace("mins", "phút").replace("min", "phút")
    x = x.replace("hours", "giờ").replace("hour", "giờ")
    x = x.replace("hrs", "giờ").replace("hr", "giờ")
    x = re.sub(r"(\d+)h", r"\1 giờ", x)
    return nspace(x)


def translate_all(unique_texts: List[str], cache_path: Path, sleep_s: float = 0.06) -> Dict[str, str]:
    if cache_path.exists():
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
    else:
        cache = {}

    total = len(unique_texts)
    done = 0

    for t in unique_texts:
        if t in cache and cache[t]:
            done += 1
            continue

        result = t
        for attempt in range(5):
            try:
                result = gtranslate_en_vi(t)
                break
            except Exception:
                time.sleep((attempt + 1) * 0.7)

        cache[t] = fix_domain_vi(result)
        done += 1

        if done % 100 == 0:
            print(f"Translated {done}/{total}")
            cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")

        time.sleep(sleep_s)

    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    return cache


def apply_translation(data: List[dict], tr: Dict[str, str], out_images_dir: Path) -> List[dict]:
    out = []
    out_images_dir.mkdir(parents=True, exist_ok=True)

    for i, r in enumerate(data, 1):
        nr = dict(r)
        rn = nspace(str(r.get("recipeName", "")))
        nr["recipeName"] = fix_domain_vi(tr.get(rn, rn))
        nr["cookingTime"] = vi_time(str(r.get("cookingTime", "")))

        new_ings = []
        for ing in r.get("ingredients", []):
            ni = dict(ing)
            key = nspace(str(ing.get("ingredientName", "")))
            ni["ingredientName"] = fix_domain_vi(tr.get(key, key))
            # unit giữ nguyên để tránh sai số mapping
            new_ings.append(ni)
        nr["ingredients"] = new_ings

        new_steps = []
        for st in r.get("cookingSteps", []):
            key = nspace(str(st.get("content", "")))
            new_steps.append({"content": fix_domain_vi(tr.get(key, key))})
        nr["cookingSteps"] = new_steps

        new_tags = []
        for tg in r.get("tags", []):
            key = nspace(str(tg.get("tagName", "")))
            new_tags.append({"tagName": fix_domain_vi(tr.get(key, key))})
        nr["tags"] = new_tags

        src_img = Path(str(r.get("imagePath", "")))
        if src_img.exists() and src_img.is_file():
            dst_img = out_images_dir / src_img.name
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
            print(f"Mapped {i}/{len(data)}")

    return out


def qa_report(data: List[dict]) -> dict:
    # Đo tỷ lệ còn token tiếng Anh thông dụng
    en_pat = re.compile(r"\b(the|and|with|into|until|stir|cook|bake|fry|boil|serve|heat|mix|add|pour|roast|grill|steam|for|minutes|hour|hours)\b", re.I)

    total_steps = 0
    bad_steps = 0
    bad_samples = []

    for r in data:
        for st in r.get("cookingSteps", []):
            total_steps += 1
            t = st.get("content", "")
            if en_pat.search(t):
                bad_steps += 1
                if len(bad_samples) < 10:
                    bad_samples.append(t)

    return {
        "totalRecipes": len(data),
        "totalSteps": total_steps,
        "suspiciousEnglishSteps": bad_steps,
        "stepVietnameseCoveragePercent": round(100 * (1 - bad_steps / max(1, total_steps)), 2),
        "sampleBadSteps": bad_samples,
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

    unique_texts = collect_unique_texts(data)
    print(f"Unique texts: {len(unique_texts)}")

    cache_path = out_dir / "translate_cache_strict.json"
    translations = translate_all(unique_texts, cache_path)

    out_data = apply_translation(data, translations, out_dir / "images")

    (out_dir / "recipes.vi.json").write_text(json.dumps(out_data, ensure_ascii=False, indent=2), encoding="utf-8")
    with open(out_dir / "recipes.vi.jsonl", "w", encoding="utf-8") as f:
        for x in out_data:
            f.write(json.dumps(x, ensure_ascii=False) + "\n")

    with open(out_dir / "import_payload_templates.vi.jsonl", "w", encoding="utf-8") as f:
        for x in out_data:
            f.write(json.dumps(x["importPayloadTemplate"], ensure_ascii=False) + "\n")

    report = qa_report(out_data)
    (out_dir / "translation_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    (out_dir / "README.md").write_text(
        "\n".join(
            [
                "# Recipe Crawl Dataset - Vietnamese strict",
                "",
                f"- Total recipes: {len(out_data)}",
                "- Source: recipe-crawl-2026-03/recipes.json",
                "- Method: direct EN->VI over original texts + strict cache + QA",
                "",
                "Files:",
                "- recipes.vi.json",
                "- recipes.vi.jsonl",
                "- import_payload_templates.vi.jsonl",
                "- translation_report.json",
                "- translate_cache_strict.json",
                "- images/",
            ]
        ),
        encoding="utf-8",
    )

    print("DONE", json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
