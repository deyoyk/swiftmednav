# Viva demo script (Anna Nagar, seed 42, SIMULATED)

1. Say: "Simulation-only academic demo, not connected to 108."
2. Open `/request`: submit accident near Anna Nagar (EN, then TA toggle).
3. Open `/dispatch`: point to top-3 — B #1 (ETA ~X, low traffic), A #2 (near but high congestion 3x on seg-a3), C excluded (missing ventilator). Open `/api/dispatch/recommend` JSON for metrics.
4. Click Approve B → audit timeline entry. Explain atomic guard + human approval (never ML-only).
5. Click "Inject closure N2→INC" → A* recomputes via N4; show nodesExplored/execMs/heuristic `haversine/22.2mps`.
6. Open `/driver`: Accept → advance enroute→onscene→onboard→athospital.
7. Open `/hospital`: Accept → handover ack (fictional vitals).
8. Open `/simulation`, `/analytics`: all charts badged SIMULATED; strategy compare nearest vs min-ETA vs capability+traffic.
9. Q&A: A* admissible heuristic? RF features + synthetic provenance + confusion matrix? RBAC + audit?
