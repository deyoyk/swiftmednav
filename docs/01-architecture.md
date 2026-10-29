# SwiftMedNav — Architecture

> Academic demonstration platform. **Simulation-only. Not connected to 108. Cannot summon a real ambulance. Not a TN Government app. No clinical validation claimed.**

## 1. System overview

```
citizen (mobile-first) ──▶ Next.js Route Handlers (/api/...) ──▶ MongoDB (Mongoose)
dispatcher dashboard ──▶ SSE (/api/stream) ◀── simulation engine (in-process, deterministic)
driver / EMT / hospital ──▶ assignment state machine (atomic transitions)
fleet / admin ──▶ analytics aggregations
                                    │
                          FastAPI ML service (:8001)
                          - POST /predict (RandomForest congestion class + proba)
                          - POST /route (A* reference impl, mirrors TS lib for cross-check)
                          - GET /model/info (version, metrics, provenance)
```

No Redis/Kafka. Real-time = Server-Sent Events. Auth = signed httpOnly session cookie (JWT) + bcrypt passwords.

## 2. Web app (`/web` → Next.js App Router, TS strict, Tailwind + shadcn/ui)

- `app/(auth)/login` — sign in
- `app/(citizen)/request` — incident reporting (EN/TA), GPS + manual pin, category, callback, tracking
- `app/(ops)/dispatch` — dark command center: Leaflet map, queues, recommend → approve/override, timeline, audit
- `app/(ops)/driver` — large controls, accept/reject, status buttons, reroute, voice (SpeechSynthesis)
- `app/(ops)/emt` — vitals, notes, handover summary (fictional only)
- `app/(ops)/hospital` — light surface, incoming, accept/escalate, handover ack
- `app/(ops)/fleet` — CRUD ambulances, status, maintenance
- `app/(ops)/simulation` — digital twin controls, strategy comparison (Recharts)
- `app/(ops)/analytics` — response-time dist, utilization, CSV export
- `app/(ops)/explain` — embedded per-incident panel (candidates, exclusions, A* viz)
- `components/` — `ui/` (shadcn primitives), `map/`, `charts/`, `explain/`, `lang/`
- `lib/` — `auth.ts`, `rbac.ts`, `db.ts`, `graph.ts` (A*), `recommend.ts`, `simulate.ts`, `validate.ts` (Zod), `sse.ts`
- `models/` — Mongoose schemas (see 02-database-schema)

## 3. Routing / dispatch core

- Road network: directed adjacency list. Edge cost = travel time (s), nonnegative. Closure = edge removed. Congestion multiplier from `trafficObservations` (observed) / `congestionPredictions` (predicted) / sim override (simulated) — UI badges always label source.
- A* (`lib/graph.ts`): binary-heap open set, `h(n) = haversine(n,goal)/v_max` (v_max=22.2 m/s ≈ 80 km/h urban emergency max, documented), zero-heuristic fallback. Returns path, cost, nodesExplored, execMs, alternative costs (2nd/3rd via penalty), validity checks.
- Recommendation (`lib/recommend.ts`): capability filter → A* ETA per candidate → freshness penalty → rank. Never sole-ML: ML only adjusts edge multiplier, human approval required. Output top-3 + exclusions + explanations.
- Assignment: atomic `findOneAndUpdate` with status guard (pending→assigned→acknowledged→enroute→onscene→onboard→athospital→handover→completed). Duplicate-dispatch prevented by idempotency key + guard. Every transition → `auditLogs` + `simulationEvents` + SSE broadcast.

## 4. ML service (`/ml-service`, FastAPI + scikit-learn)

- Synthetic dataset (`data/synthetic_traffic.csv`, seed 42, provenance documented) with features `vehicle_count, avg_speed, hour` → `congestion {low,medium,high}`.
- `train.py` → stratified 80/20 split, RandomForest (n=200, seed 42), held-out precision/recall/F1 + confusion matrix → `modelEvaluations` doc + `model.json` version.
- Endpoints validate with Pydantic; return `{class, probabilities, modelVersion, source: predicted}`.
- Web app calls with timeout (2s) + fallback to observed/simulated; stale-traffic warning if observation age > 5 min.

## 5. Data & simulation

- MongoDB collections (16, see schema doc) with indexes on status, geo, timestamps.
- Simulation engine (`lib/simulate.ts`): seeded PRNG (mulberry32), tick = move ambulances along route polyline, emit events, support pause/resume/reset/replay, inject closures/breakdowns/capacity changes. Strategies compared: nearest vs min-ETA vs capability+traffic-aware.
- Seed scenario: Anna Nagar accident + ambulances A (near/congested), B (far/fast), C (incapable) + 1 hospital.

## 6. Security / reliability

Server RBAC on every route, Zod validation, rate-limit sensitive POSTs, audit logs, location freshness badge, GPS fallback (manual pin), safe state transitions, privacy-aware projections (citizen sees own incidents only), retention config, simulation-only guard (`SIMULATION_ONLY=true` blocks any real-dispatch copy).

## 7. Repo structure

```
swiftmednav/
  docs/  web/  ml-service/  scripts/
  web/{app,components,lib,models,tests}
  ml-service/{app.py,train.py,evaluate.py,data/,models/}
```
