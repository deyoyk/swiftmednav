# SwiftMedNav (academic simulation demo)

> **SIMULATION ONLY. Not connected to 108. Cannot summon a real ambulance. Not a TN Government app. No clinical validation.**

## Quick start (one terminal, from repo root)
```bat
run.cmd            :: dev: setup (first run) + ML :8001 + web :3000
run.cmd start      :: production build + start
run.cmd reseed     :: force re-seed of MongoDB demo data
```
```bash
./run.sh           # or ./run.sh start | ./run.sh reseed   (macOS/Linux/Git Bash)
```
First run automatically: creates `web/.env.local`, `npm install`, `pip install -r ml-service/requirements.txt`, trains the RF model (`train.py`, skipped if `rf_model.pkl` exists), seeds MongoDB (`npm run seed`, skipped if `web/.seeded` exists — the demo also works without Mongo via the in-memory store). `Ctrl+C` stops both servers.

## Manual setup (if you prefer step-by-step)
```bash
# web (no DB needed for demo — in-memory simulated store; Mongo optional for persistence)
cd web && npm install && npm run dev  # :3000
npm test          # vitest 13/13: A*, recommend, dispatch transitions, sim determinism
node smoke.js     # full E2E over HTTP (needs `npm run start -- -p 3100` running; SMOKE PASS)
npm run seed      # optional, needs MongoDB up; seeds users/ambulances/incident
# ml (needs scikit-learn; pip install takes a while — UI falls back to local heuristic meanwhile)
cd ml-service && pip install scikit-learn pandas numpy && python train.py && python evaluate.py
uvicorn app:app --port 8001  # FastAPI RF service; web proxies /api/ml/* with 2s timeout + fallback
```
Demo logins (after seed): `dispatch@demo.local / demo1234` (also driver-a, driver-b, emt, hosp, citizen).

## Viva demo (2 min)
1. `/request` → submit simulated accident. 2. `/dispatch` → top-3: AMB-B recommended (free corridor) over AMB-A (high congestion) over AMB-C (excluded: no ventilator). 3. Approve → audit log. 4. Inject closure N2→INC → A* reroutes. 5. `/driver` accept → advance to handover. 6. `/hospital` accept/ack. 7. `/analytics` shows simulated metrics. See `docs/07-demo-script.md`.

## Docs
`docs/01-architecture.md` · `02-database-schema.md` · `03-api-spec.md` · `04-permissions.md` · `05-milestones-testing.md`
