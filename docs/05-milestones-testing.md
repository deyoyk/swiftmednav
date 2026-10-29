# Milestones

- **M0 Arch (this docs set)** — done when docs 01–06 + scaffold + seed graph reviewed.
- **M1 Phase 1** — auth + seed login for 7 roles; dashboards render by role; district scoping works.
- **M2 Phase 2** — citizen creates INC → dispatch sees it live (SSE) → propose/approve atomic, no double-dispatch.
- **M3 Phase 3** — A* tests pass; recommend returns ranked top-3 with exclusions + metrics; explain panel renders A* exploration.
- **M4 Phase 4** — driver accept → status chain → hospital notify/accept → handover ack → completed → analytics updates. E2E demo script passes.
- **M5 Phase 5** — sim pause/resume/reset/replay deterministic (same seed → same event log); 3-strategy comparison charts labeled simulated.
- **M6 Phase 6** — `train.py` reproduces metrics; `/predict` validated; UI shows confidence + source labels; stale-data warnings work.
- **M7 Phase 7 (viva)** — `npm test` + `pytest` green, README setup <10 min, demo: Anna Nagar incident → B recommended over A (congestion) over C (excluded) → closure → reroute → handover.

# Testing strategy

- **TS (vitest)**: `graph.test.ts` (shortest-path optimality vs Dijkstra on fixtures, heuristic admissibility, closure/one-way, fallback on disconnected); `recommend.test.ts` (capability filter, C excluded, B beats A under congestion); `transitions.test.ts` (legal/illegal jumps, atomic double-assign guard); `simulate.test.ts` (deterministic seed replay).
- **Python (pytest)**: `test_train.py` (split reproducibility, RF fits, metrics in range, confusion-matrix shape), `test_api.py` (validation 422, proba sums to 1).
- **E2E (playwright smoke, optional)**: citizen→dispatch→driver→hospital→completed happy path on seed.
- **Manual viva checklist**: `docs/07-demo-script.md`. No synthetic accuracy presented as real-world; all simulated charts badged `SIMULATED`.
