#!/usr/bin/env python3
import argparse
import json
import re
import time
from pathlib import Path
from typing import Dict, List
from urllib.parse import quote

import requests

EN_PATTERN = re.compile(r"\b(the|and|with|into|until|stir|cook|bake|fry|boil|serve|heat|mix|add|pour|roast|grill|steam|minutes|hour)\b", re.I)


def is_suspicious_en(text: str) -> bool:
    if not text:
        return False
    # ưu tiên phát hiện từ nối/động từ tiếng Anh thực dụng
    if EN_PATTERN.search(text):
        return True
    # hoặc quá nhiều ascii word
    words = re.findall(r"[A-Za-z]{3,}", text)
    return len(words) >= 4


def gtranslate(text: str, timeout: int = 15) -> str:
    q = quote(text)
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q={q}"
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    arr = r.json()
    if isinstance(arr, list) and arr and isinstance(arr[0], list):
        parts = []
        for seg in arr[0]:
            if isinstance(seg, list) and seg:
                parts.append(seg[0])
        out = "".join(parts).strip()
        return out if out else text
    return text


def collect_suspicious(data: List[dict]) -> List[str]:
    texts = []
    for r in data:
        for key in ["recipeName"]:
            t = str(r.get(key, ""))
            if is_suspicious_en(t):
                texts.append(t)
        for ing in r.get("ingredients", []):
            t = str(ing.get("ingredientName", ""))
            if is_suspicious_en(t):
                texts.append(t)
        for st in r.get("cookingSteps", []):
            t = str(st.get("content", ""))
            if is_suspicious_en(t):
                texts.append(t)
        for tg in r.get("tags", []):
            t = str(tg.get("tagName", ""))
            if is_suspicious_en(t):
                texts.append(t)
    seen = set()
    out = []
    for t in texts:
        tt = re.sub(r"\s+", " ", t).strip()
        if tt and tt not in seen:
            seen.add(tt)
            out.append(tt)
    return out


def apply_map(data: List[dict], mp: Dict[str, str]) -> None:
    for r in data:
        if r.get("recipeName") in mp:
            r["recipeName"] = mp[r["recipeName"]]
        for ing in r.get("ingredients", []):
            t = ing.get("ingredientName")
            if t in mp:
                ing["ingredientName"] = mp[t]
        for st in r.get("cookingSteps", []):
            t = st.get("content")
            if t in mp:
                st["content"] = mp[t]
        for tg in r.get("tags", []):
            t = tg.get("tagName")
            if t in mp:
                tg["tagName"] = mp[t]

        r["importPayloadTemplate"] = {
            "recipeName": r.get("recipeName", ""),
            "cookingTime": r.get("cookingTime", ""),
            "ration": r.get("ration", 2),
            "userId": "<SET_USER_ID>",
            "ingredients": r.get("ingredients", []),
            "cookingSteps": r.get("cookingSteps", []),
            "tags": r.get("tags", []),
            "image": r.get("imagePath", ""),
        }


def qa(data: List[dict]) -> dict:
    ts = 0
    bads = 0
    tis = 0
    badi = 0
    for r in data:
        for st in r.get("cookingSteps", []):
            ts += 1
            if is_suspicious_en(str(st.get("content", ""))):
                bads += 1
        for ing in r.get("ingredients", []):
            tis += 1
            if is_suspicious_en(str(ing.get("ingredientName", ""))):
                badi += 1
    return {
        "totalRecipes": len(data),
        "totalSteps": ts,
        "suspiciousEnglishSteps": bads,
        "stepVietnameseCoveragePercent": round(100 * (1 - bads / max(1, ts)), 2),
        "totalIngredients": tis,
        "suspiciousEnglishIngredients": badi,
        "ingredientVietnameseCoveragePercent": round(100 * (1 - badi / max(1, tis)), 2),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-json", required=True)
    ap.add_argument("--out-json", required=True)
    ap.add_argument("--out-jsonl", required=True)
    ap.add_argument("--out-payload", required=True)
    ap.add_argument("--report", required=True)
    ap.add_argument("--cache", required=True)
    args = ap.parse_args()

    data = json.loads(Path(args.in_json).read_text(encoding="utf-8"))

    cache_path = Path(args.cache)
    if cache_path.exists():
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
    else:
        cache = {}

    sus = collect_suspicious(data)
    print(f"Suspicious unique texts: {len(sus)}")

    done = 0
    for t in sus:
        if t in cache:
            done += 1
            continue
        out = t
        for k in range(4):
            try:
                out = gtranslate(t, timeout=20)
                break
            except Exception:
                time.sleep((k + 1) * 0.8)
        cache[t] = out
        done += 1
        if done % 50 == 0:
            print(f"Translated {done}/{len(sus)}")
            cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
        time.sleep(0.08)

    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")

    apply_map(data, cache)
    report = qa(data)

    Path(args.out_json).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    with open(args.out_jsonl, "w", encoding="utf-8") as f:
        for x in data:
            f.write(json.dumps(x, ensure_ascii=False) + "\n")
    with open(args.out_payload, "w", encoding="utf-8") as f:
        for x in data:
            f.write(json.dumps(x["importPayloadTemplate"], ensure_ascii=False) + "\n")
    Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("DONE", json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
