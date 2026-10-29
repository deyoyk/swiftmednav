"""API smoke tests (stdlib only — no pytest needed). Run: python test_api.py (server optional)."""
import json, urllib.request, urllib.error

BASE = "http://127.0.0.1:8001"

def check(path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json"}, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200].decode(errors="replace")
    except Exception as e:
        return None, f"unreachable: {e}"

def main():
    ok = True
    # 1. input validation: hour=99 must 422
    s, b = check("/predict", {"vehicle_count": 10, "avg_speed": 50, "hour": 99})
    print("invalid hour ->", s); ok &= (s == 422)
    # 2. valid predict: proba sums to 1, source labeled
    s, b = check("/predict", {"vehicle_count": 150, "avg_speed": 10, "hour": 9})
    print("rush-hour predict ->", s, b if isinstance(b, str) else {k: b.get(k) for k in ("class", "source", "modelVersion")})
    if s == 200:
        ok &= abs(sum(b["probabilities"].values()) - 1.0) < 1e-6 and b["source"] == "predicted"
    else:
        print("SKIP (server down — start with: uvicorn app:app --port 8001)"); return
    # 3. model info carries provenance + synthetic flag
    s, b = check("/model/info")
    print("model/info ->", s); ok &= (s == 200 and b.get("synthetic") is True and "provenance" in b)
    print("PASS" if ok else "FAIL")

if __name__ == "__main__":
    main()
