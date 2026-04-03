#!/usr/bin/env python3
import json
import random
import string
import requests
from typing import Callable, Tuple, List

BASE = "http://127.0.0.1:13081"
TIMEOUT = 40

results: List[dict] = []

def rec(name, status, ok, note=""):
    results.append({"name": name, "status": status, "ok": ok, "note": note})


def call(name: str, method: str, path: str, expected: Tuple[int, ...], headers=None, json_body=None, params=None, files=None):
    url = f"{BASE}{path}"
    try:
        r = requests.request(method, url, headers=headers, json=json_body, params=params, files=files, timeout=TIMEOUT)
        ok = r.status_code in expected
        note = ""
        if not ok:
            note = r.text[:300]
        rec(name, r.status_code, ok, note)
        return r
    except Exception as e:
        rec(name, -1, False, str(e))
        return None


def token_headers(token: str):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def dual_chat_headers(token: str):
    return {
        "Authorization": f"Bearer {token}",
        "x-api-key": "__CHANGE_ME_CHAT_API_KEY__",
        "Content-Type": "application/json"
    }


def rand_phone():
    return "09" + "".join(random.choice(string.digits) for _ in range(8))


def main():
    # ---------- Setup temp user ----------
    phone = rand_phone()
    email = f"fullcheck_{random.randint(1000,999999)}@test.local"
    password = "Abc@123456"
    fullname = "Full API Check"

    call("users/all", "GET", "/api/users/all", (200,))

    r = call("users/register", "POST", "/api/users/register", (201,), json_body={
        "phone": phone,
        "email": email,
        "password": password,
        "fullName": fullname
    }, headers={"Content-Type": "application/json"})

    login = call("users/login", "POST", "/api/users/login", (200,), json_body={
        "identifier": phone,
        "password": password
    }, headers={"Content-Type": "application/json"})

    if not login:
        raise SystemExit(1)

    lj = login.json()
    token = lj.get("data", {}).get("accessToken", "")
    refresh = lj.get("data", {}).get("refreshToken", "")
    user = lj.get("data", {}).get("user", {})
    user_id = user.get("userId")

    if not token:
        rec("bootstrap/token", -1, False, "No access token from login")
        print_report()
        raise SystemExit(1)

    auth = token_headers(token)
    chat_auth = dual_chat_headers(token)

    # refresh
    call("users/refresh-token", "POST", "/api/users/refresh-token", (200,), headers={"Content-Type": "application/json"}, json_body={"refreshToken": refresh})

    # users private
    call("users/recipes-view-history unauthorized", "GET", "/api/users/recipes-view-history", (401,))
    call("users/recipes-view-history authorized", "GET", "/api/users/recipes-view-history", (200,), headers={"Authorization": f"Bearer {token}"})
    call("users/update-user-information", "POST", "/api/users/update-user-information", (200,), headers=auth, json_body={
        "fullName": fullname + " Updated",
        "phone": phone,
        "email": email
    })
    call("users/me", "PATCH", "/api/users/me", (200,), headers=auth, json_body={
        "fullName": fullname + " Updated2",
        "phone": phone,
        "email": email
    })

    # password flows (temp user)
    call("users/change-password", "POST", "/api/users/change-password", (201,), headers={"Content-Type": "application/json"}, json_body={
        "phone": phone,
        "currentPassword": password,
        "newPassword": "Abc@654321"
    })
    call("users/forgot-password", "POST", "/api/users/forgot-password", (201,), headers={"Content-Type": "application/json"}, json_body={
        "phone": phone
    })
    call("users/login after forgot-password", "POST", "/api/users/login", (200,), headers={"Content-Type": "application/json"}, json_body={
        "identifier": phone,
        "password": "1"
    })

    # ---------- Recipes ----------
    all_recipes = call("recipes/all", "GET", "/api/recipes/all", (200,))
    recipe_items = []
    if all_recipes is not None:
        try:
            recipe_items = all_recipes.json().get("data", [])
        except Exception:
            pass
    recipe_id = recipe_items[0]["recipeId"] if recipe_items else 1115

    call("recipes/search GET", "GET", "/api/recipes/search", (200,), params={"q": "ga"})
    call("recipes/search POST", "POST", "/api/recipes/search", (200,), headers={"Content-Type": "application/json"}, json_body={"recipeName": "ga"})
    call("recipes/ingredients", "GET", "/api/recipes/ingredients", (200,))
    call("recipes/tags", "GET", "/api/recipes/tags", (200,))
    call("recipes/trending", "GET", "/api/recipes/trending", (200,), params={"page": 1, "limit": 10, "period": "all"})
    call("recipes/trending-v2", "GET", "/api/recipes/trending-v2", (200,), params={"page": 1, "limit": 10, "period": "all"})
    call("recipes/by-tag GET", "GET", "/api/recipes/by-tag", (200,), params={"tagName": "com"})
    call("recipes/search-by-tag POST", "POST", "/api/recipes/search-by-tag", (200,), headers={"Content-Type": "application/json"}, json_body={"tagName": "com"})
    call("recipes/growth-report", "GET", "/api/recipes/growth-report", (200,))

    # optional token personalization
    tr_no = call("recipes/trending no token (optional)", "GET", "/api/recipes/trending", (200,), params={"page": 1, "limit": 20})
    call("interactions/like for personalization", "POST", "/api/interactions/like", (200,), headers=auth, json_body={"recipeId": recipe_id})
    tr_with = call("recipes/trending with token (optional)", "GET", "/api/recipes/trending", (200,), params={"page": 1, "limit": 20}, headers={"Authorization": f"Bearer {token}"})

    try:
        no_items = tr_no.json().get("data", {}).get("items", []) if tr_no else []
        wi_items = tr_with.json().get("data", {}).get("items", []) if tr_with else []
        no_flag = next((x.get("isLiked") for x in no_items if x.get("recipeId") == recipe_id), None)
        wi_flag = next((x.get("isLiked") for x in wi_items if x.get("recipeId") == recipe_id), None)
        rec("recipes/trending personalization assert", 200, (no_flag is False and wi_flag is True), f"no_token={no_flag}, with_token={wi_flag}")
    except Exception as e:
        rec("recipes/trending personalization assert", -1, False, str(e))

    # private recipe endpoints
    call("recipes/top-trending unauthorized", "GET", "/api/recipes/top-trending", (401,))
    call("recipes/top-trending authorized GET", "GET", "/api/recipes/top-trending", (200,), headers={"Authorization": f"Bearer {token}"})
    call("recipes/top-trending authorized POST", "POST", "/api/recipes/top-trending", (200,), headers=auth, json_body={})
    call("recipes/me unauthorized", "GET", "/api/recipes/me", (401,))
    call("recipes/me authorized", "GET", "/api/recipes/me", (200,), headers={"Authorization": f"Bearer {token}"})
    call("recipes/user-recipes POST authorized", "POST", "/api/recipes/user-recipes", (200,), headers=auth, json_body={})
    call("recipes/admin/pending authorized", "GET", "/api/recipes/admin/pending", (200,), headers={"Authorization": f"Bearer {token}"})
    call("recipes/admin/review invalid payload", "PATCH", "/api/recipes/admin/review", (400,), headers={"Content-Type": "application/json"}, json_body={"recipeId": 0, "status": "approved"})

    # create recipe route checks (not actually creating)
    call("recipes/create unauthorized", "POST", "/api/recipes/create", (401,), headers={"Content-Type": "application/json"}, json_body={})
    call("recipes/create authorized invalid body", "POST", "/api/recipes/create", (400,), headers={"Authorization": f"Bearer {token}"}, files={})

    # ---------- Interactions ----------
    call("interactions/comments", "GET", "/api/interactions/comments", (200,))
    call("interactions/increase-view-count", "POST", "/api/interactions/increase-view-count", (200,), headers={"Content-Type": "application/json"}, json_body={"recipeId": recipe_id})
    call("interactions/like unauthorized", "POST", "/api/interactions/like", (401,), headers={"Content-Type": "application/json"}, json_body={"recipeId": recipe_id})
    call("interactions/like authorized", "POST", "/api/interactions/like", (200,), headers=auth, json_body={"recipeId": recipe_id})
    c = call("interactions/comment authorized", "POST", "/api/interactions/comment", (201,), headers=auth, json_body={"recipeId": recipe_id, "content": "full api test comment"})

    comment_id = None
    coms = call("interactions/comments reload", "GET", "/api/interactions/comments", (200,))
    try:
        data = coms.json().get("data", []) if coms else []
        for x in data:
            if x.get("content") == "full api test comment" and x.get("commentUser", {}).get("userId") == user_id:
                comment_id = x.get("commentId")
                break
    except Exception:
        pass

    if comment_id:
        call("interactions/delete-comment unauthorized", "DELETE", "/api/interactions/comment", (401,), headers={"Content-Type": "application/json"}, json_body={"commentId": comment_id})
        call("interactions/delete-comment authorized", "DELETE", "/api/interactions/comment", (200,), headers=auth, json_body={"commentId": comment_id})
    else:
        rec("interactions/delete-comment setup", -1, False, "Could not locate created comment")

    # ---------- Pantry ----------
    call("pantry/get unauthorized", "GET", "/api/pantry", (401,))
    call("pantry/get authorized", "GET", "/api/pantry", (200,), headers={"Authorization": f"Bearer {token}"})
    up = call("pantry/upsert", "POST", "/api/pantry/upsert", (200,), headers=auth, json_body={
        "ingredientName": "Full API Ingredient",
        "quantity": 2,
        "unit": "cai"
    })

    pantry_id = None
    p = call("pantry/get after upsert", "GET", "/api/pantry", (200,), headers={"Authorization": f"Bearer {token}"})
    try:
        items = p.json().get("data", []) if p else []
        for i in items:
            if str(i.get("ingredientName", "")).lower() in ("full api ingredient", "full api ingredient"):
                pantry_id = i.get("pantryItemId")
                break
        if pantry_id is None and items:
            pantry_id = items[0].get("pantryItemId")
    except Exception:
        pass

    if pantry_id:
        call("pantry/delete unauthorized", "DELETE", "/api/pantry/delete", (401,), headers={"Content-Type": "application/json"}, json_body={"pantryItemId": pantry_id})
        call("pantry/delete authorized", "DELETE", "/api/pantry/delete", (200,), headers=auth, json_body={"pantryItemId": pantry_id})
    else:
        rec("pantry/delete setup", -1, False, "No pantry item found")

    # ---------- Diet ----------
    call("diet/get unauthorized", "GET", "/api/user-diet-notes", (401,))
    call("diet/get authorized", "GET", "/api/user-diet-notes", (200,), headers={"Authorization": f"Bearer {token}"})
    call("diet/upsert", "POST", "/api/user-diet-notes/upsert", (200,), headers=auth, json_body={
        "noteType": "preference",
        "label": "full-api-note",
        "keywords": ["test"],
        "isActive": True
    })
    dn = call("diet/get after upsert", "GET", "/api/user-diet-notes", (200,), headers={"Authorization": f"Bearer {token}"})
    note_id = None
    try:
        arr = dn.json().get("data", []) if dn else []
        for n in arr:
            if n.get("label") == "full-api-note":
                note_id = n.get("noteId")
                break
    except Exception:
        pass
    if note_id:
        call("diet/delete unauthorized", "DELETE", "/api/user-diet-notes/delete", (401,), headers={"Content-Type": "application/json"}, json_body={"noteId": note_id})
        call("diet/delete authorized", "DELETE", "/api/user-diet-notes/delete", (200,), headers=auth, json_body={"noteId": note_id})
    else:
        rec("diet/delete setup", -1, False, "No note found")

    # ---------- AI chat v1 dual-auth ----------
    # must fail with one factor only
    call("ai-chat/sessions only bearer", "POST", "/api/ai-chat/sessions", (401,), headers=auth, json_body={"title": "one-factor"})
    call("ai-chat/sessions only api-key", "POST", "/api/ai-chat/sessions", (401,), headers={"x-api-key": "__CHANGE_ME_CHAT_API_KEY__", "Content-Type": "application/json"}, json_body={"userId": user_id, "title": "one-factor"})

    c1 = call("ai-chat/sessions dual-auth", "POST", "/api/ai-chat/sessions", (201,), headers=chat_auth, json_body={"title": "full-check-chat-v1"})
    sid = None
    try:
        sid = c1.json().get("data", {}).get("chatSessionId") if c1 else None
    except Exception:
        pass

    call("ai-chat/sessions list dual-auth", "GET", "/api/ai-chat/sessions", (200,), headers={"Authorization": f"Bearer {token}", "x-api-key": "__CHANGE_ME_CHAT_API_KEY__"})
    if sid:
        call("ai-chat/session history dual-auth", "GET", f"/api/ai-chat/sessions/{sid}", (200,), headers={"Authorization": f"Bearer {token}", "x-api-key": "__CHANGE_ME_CHAT_API_KEY__"})
        call("ai-chat/session title patch dual-auth", "PATCH", "/api/ai-chat/sessions/title", (200,), headers=chat_auth, json_body={"chatSessionId": sid, "title": "renamed"})
        call("ai-chat/active-recipe patch dual-auth", "PATCH", "/api/ai-chat/sessions/active-recipe", (200,), headers=chat_auth, json_body={"chatSessionId": sid, "recipeId": None})
    call("ai-chat/recommendations GET dual-auth", "GET", "/api/ai-chat/recommendations-from-pantry", (200,), headers={"Authorization": f"Bearer {token}", "x-api-key": "__CHANGE_ME_CHAT_API_KEY__"})
    call("ai-chat/recommendations POST dual-auth", "POST", "/api/ai-chat/recommendations-from-pantry", (200,), headers=chat_auth, json_body={"limit": 5})
    call("ai-chat/messages GET dual-auth", "GET", "/api/ai-chat/messages", (200,), headers={"Authorization": f"Bearer {token}", "x-api-key": "__CHANGE_ME_CHAT_API_KEY__"})
    call("ai-chat/messages POST dual-auth", "POST", "/api/ai-chat/messages", (200, 503), headers=chat_auth, json_body={"message": "xin chao full test"})
    call("ai-chat/resolve-previous invalid", "POST", "/api/ai-chat/sessions/resolve-previous", (400,), headers=chat_auth, json_body={"previousSessionId": 0, "action": "invalid"})
    if sid:
        call("ai-chat/delete session dual-auth", "DELETE", f"/api/ai-chat/sessions/{sid}", (200,), headers={"Authorization": f"Bearer {token}", "x-api-key": "__CHANGE_ME_CHAT_API_KEY__"})

    # ---------- AI chat v2 dual-auth ----------
    call("ai-chat-v2/create one-factor bearer", "POST", "/api/ai-chat/v2/sessions/meal", (401,), headers=auth, json_body={"title": "fail", "recipeIds": [recipe_id]})
    call("ai-chat-v2/create one-factor api-key", "POST", "/api/ai-chat/v2/sessions/meal", (401,), headers={"x-api-key": "__CHANGE_ME_CHAT_API_KEY__", "Content-Type": "application/json"}, json_body={"userId": user_id, "title": "fail", "recipeIds": [recipe_id]})

    m = call("ai-chat-v2/create dual-auth", "POST", "/api/ai-chat/v2/sessions/meal", (201,), headers=chat_auth, json_body={"title": "full-check-v2", "recipeIds": [recipe_id]})
    msid = None
    try:
        msid = m.json().get("data", {}).get("session", {}).get("chatSessionId") if m else None
    except Exception:
        pass

    if msid:
        call("ai-chat-v2/replace recipes dual-auth", "PATCH", "/api/ai-chat/v2/sessions/meal/recipes", (200,), headers=chat_auth, json_body={"chatSessionId": msid, "recipeIds": [recipe_id]})
        call("ai-chat-v2/update status dual-auth", "PATCH", "/api/ai-chat/v2/sessions/meal/recipes/status", (200,), headers=chat_auth, json_body={"chatSessionId": msid, "recipeId": recipe_id, "status": "cooking"})
        call("ai-chat-v2/set primary dual-auth", "PATCH", "/api/ai-chat/v2/sessions/meal/primary-recipe", (200,), headers=chat_auth, json_body={"chatSessionId": msid, "recipeId": recipe_id})
        call("ai-chat-v2/messages dual-auth", "POST", "/api/ai-chat/v2/messages", (200, 503), headers=chat_auth, json_body={"chatSessionId": msid, "message": "món hiện tại làm gì đầu tiên"})
        call("ai-chat-v2/complete dual-auth", "PATCH", "/api/ai-chat/v2/sessions/meal/complete", (200,), headers=chat_auth, json_body={"chatSessionId": msid, "completionType": "completed", "markRemainingStatus": "done"})

    # ---------- API docs ----------
    call("api-docs html", "GET", "/api-docs", (200,))
    call("api-docs openapi", "GET", "/api-docs/openapi.json", (200,))

    print_report()


def print_report():
    total = len(results)
    failed = [r for r in results if not r["ok"]]
    passed = total - len(failed)

    print("\n===== FULL API CHECK 13081 =====")
    print(f"Total: {total} | Passed: {passed} | Failed: {len(failed)}")

    for r in results:
        flag = "PASS" if r["ok"] else "FAIL"
        print(f"[{flag}] {r['status']} - {r['name']}")
        if r.get("note") and not r["ok"]:
            print(f"       note: {r['note']}")

    if failed:
        print("\nFAILED CASES:")
        for r in failed:
            print(f"- {r['name']} (status={r['status']})")


if __name__ == "__main__":
    main()
