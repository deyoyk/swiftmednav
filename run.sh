#!/usr/bin/env bash
# SwiftMedNav one-terminal launcher for macOS/Linux/Git Bash.
# Usage: ./run.sh [dev|start] [reseed]
#   dev    - Next.js dev server, default
#   start  - production build + start
#   reseed - force re-run of the MongoDB demo seed, otherwise seeded once
# Needs: Node.js 20+ and Python 3.10+ on PATH. First run does npm install,
# pip install, RF model training, MongoDB seed.
set -e
cd "$(dirname "$0")"

MODE="dev"
RESEED=""
for a in "$@"; do
  [ "$a" = "start" ] && MODE="start"
  [ "$a" = "reseed" ] && RESEED="1"
done
FAILED=""

command -v node >/dev/null 2>&1 || { echo "[error] node not found on PATH. Install Node.js 20+ then retry."; FAILED="1"; }
command -v npm >/dev/null 2>&1 || { echo "[error] npm not found on PATH. Install Node.js 20+ then retry."; FAILED="1"; }
command -v python3 >/dev/null 2>&1 || { echo "[warn] python3 not found on PATH. Web will run, ML will use built-in fallback."; }
if [ -n "$FAILED" ]; then echo "Launch FAILED - window stays open so you can read the error."; read -r -p "Press Enter to close..."; exit 1; fi

if command -v lsof >/dev/null 2>&1; then
  lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1 && { echo "[error] port 3000 is already in use. Stop the other server and retry."; FAILED="1"; }
  lsof -i :8001 -sTCP:LISTEN >/dev/null 2>&1 && { echo "[error] port 8001 is already in use. Stop the other ML service and retry."; FAILED="1"; }
elif command -v ss >/dev/null 2>&1; then
  ss -ltn 2>/dev/null | grep -q ":3000 " && { echo "[error] port 3000 is already in use. Stop the other server and retry."; FAILED="1"; }
  ss -ltn 2>/dev/null | grep -q ":8001 " && { echo "[error] port 8001 is already in use. Stop the other ML service and retry."; FAILED="1"; }
fi
if [ -n "$FAILED" ]; then echo "Launch FAILED - window stays open so you can read the error."; read -r -p "Press Enter to close..."; exit 1; fi

[ -f web/.env.local ] || { echo "[setup] creating web/.env.local from .env.example"; cp web/.env.example web/.env.local || echo "[warn] could not create web/.env.local"; }

[ -d web/node_modules ] || { echo "[setup] installing web dependencies - first run only"; npm --prefix web install --no-audit --no-fund; }
[ -d web/node_modules ] || { echo "[error] web dependencies missing and install failed."; read -r -p "Press Enter to close..."; exit 1; }

if ! python3 -c "import fastapi, uvicorn, sklearn, pandas" 2>/dev/null; then
  echo "[setup] installing Python dependencies - first run only, may take a while"
  python3 -m pip install -r ml-service/requirements.txt || echo "[warn] pip install had errors - ML service may fall back to heuristics."
fi

if [ ! -f ml-service/models/rf_model.pkl ]; then
  echo "[setup] training RandomForest model - seed 42, synthetic demo data"
  (cd ml-service && python3 train.py) || echo "[warn] training failed - API will use the heuristic fallback."
fi

if [ -n "$RESEED" ]; then
  echo "[setup] reseed requested - old demo data will be replaced."
  rm -f web/.seeded
fi
if [ ! -f web/.seeded ]; then
  echo "[setup] seeding MongoDB demo data - users, ambulances, Anna Nagar incident"
  if npm --prefix web run seed; then
    echo ok > web/.seeded
  else
    echo "[warn] seed failed - is MongoDB running? Demo works without it."
  fi
else
  echo "[setup] demo data already seeded - use ./run.sh reseed to force."
fi

echo ""
echo "[ml] starting FastAPI on http://127.0.0.1:8001 ..."
python3 -m uvicorn app:app --port 8001 --app-dir ml-service &
ML_PID=$!
trap "echo '[shutdown] stopping ML service...'; kill $ML_PID 2>/dev/null" EXIT

if [ "$MODE" = "start" ]; then
  echo "[web] building production bundle..."
  npm --prefix web run build
  echo "[web] starting production server on http://localhost:3000 ..."
  npm --prefix web run start -- -p 3000
else
  echo "[web] starting dev server on http://localhost:3000 ..."
  npm --prefix web run dev -- -p 3000
fi
