# API specification (Next.js Route Handlers, `/api/...`)

Auth: session cookie. All responses `{ ok, data?, error? }`. RBAC matrix in `04-permissions.md`. Validation: Zod. Rate-limited: `POST /incidents`, `/assignments/*/approve`, `/auth/login`.

## Auth
- `POST /api/auth/login {email,password}` → sets cookie. Roles: all.
- `POST /api/auth/logout` → clears.
- `GET /api/auth/me` → current user (safe projection).
- `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id {status,role,districtId}` (super/district admin).

## Incidents (citizen + dispatcher)
- `POST /api/incidents` (citizen, dispatcher) — Zod: category, priority, lng/lat or addressText, contactPhone, requiredCapabilities[]. Returns incident + idempotency guard.
- `GET /api/incidents?status=&districtId=&q=` (dispatcher, admin) — paged, district-scoped.
- `GET /api/incidents/:id` (owner, assigned parties, ops roles) — includes timeline, assignment, route, handover (privacy-projected).
- `PATCH /api/incidents/:id/status {to, note}` — guarded transitions only.

## Dispatch
- `GET /api/dispatch/recommend?incidentId=` (dispatcher) → `{ candidates[3], exclusions, modelInfo, graphMetrics }` — runs A* per candidate, labels traffic source.
- `POST /api/assignments {incidentId, ambulanceId?, strategy}` → atomic propose (guards pending + no active assignment).
- `POST /api/assignments/:id/approve {ambulanceId?, overrideReason?}` (dispatcher) → approved + route persisted + SSE.
- `POST /api/assignments/:id/acknowledge {accept, reason?}` (driver) → acknowledged or rejected→incident back to pending.
- `POST /api/assignments/:id/reassign {ambulanceId, reason}` (dispatcher).

## Routes / traffic / ML
- `GET /api/routes?incidentId=&assignmentId=` → route + `nodesExplored, costSec, altCosts, execMs`.
- `POST /api/routes/reroute {assignmentId, closures[]}` → new A* route, old kept for compare.
- `GET /api/traffic?segmentId=` → `{ observed, predicted, simulated }` with source labels + freshness.
- `POST /api/ml/predict` → proxied to FastAPI (2s timeout, fallback), logs `congestionPredictions`.
- `GET /api/ml/model-info` → version + held-out metrics (synthetic-labeled).

## Fleet / hospitals / EMT
- `GET/POST /api/fleet`, `PATCH /api/fleet/:id` (fleet/admin, dispatcher read).
- `POST /api/fleet/:id/location {lng,lat,speedKph,source}` (driver, sim).
- `GET/POST /api/hospitals`, `GET/PATCH /api/hospitals/:id/resources` (hospital_coordinator).
- `POST /api/handoffs {incidentId,...vitals, notes}` + `POST /api/handoffs/:id/ack {decision: accept|escalate}` (fictional only).

## Simulation / analytics / realtime
- `GET/POST /api/simulation/scenarios`, `POST /api/simulation/:id/{start,pause,resume,reset}`, `POST /api/simulation/:id/inject {kind,...}`, `GET /api/simulation/:id/compare?strategies=` → metrics per strategy.
- `GET /api/analytics/summary?districtId=&from=&to=` → counts, response-time dist, utilization, handover stats (simulated-labeled) + `GET .../export?format=csv`.
- `GET /api/stream?topics=incidents,assignments,fleet,simulation` — SSE.
- `GET /api/audit?entity=&entityId=` (admin, dispatcher read-own-district).

State machine: `pending→assigned→acknowledged→enroute→onscene→onboard→athospital→handover→completed` (+`rejected→pending`, `cancelled`). Illegal jumps → 409.
