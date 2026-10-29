# Database schema (Mongoose)

All timestamps `createdAt/updatedAt`. Simulation-only flag on incidents. Indexes listed per model.

## users
`{ email unique, passwordHash, role: super_admin|district_admin|dispatcher|driver|emt|hospital_coordinator|citizen, orgId ref organizations, districtId ref districts, name, phone, lang: en|ta, status: active|suspended, lastLoginAt }` — index `{role, districtId}`, `{email}`.

## organizations / districts
- org: `{ name, type: govt|hospital|fleet|community, districtId }`
- district: `{ name unique (e.g. Chennai-North), code unique, bounds: {minLng,minLat,maxLng,maxLat} }`

## ambulances
`{ vehicleId unique (e.g. AMB-A), type: BLS|ALS|NEONATAL|SPECIALIST, capabilities: string[] (oxygen, ventilator, incubator...), status: available|assigned|enroute|maintenance|offline|breakdown, districtId, driverId ref users, homeBase: {lng,lat}, odometerKm, maintenanceDueAt }` — index `{status, districtId}`, `{type}`.

## ambulanceLocations
`{ ambulanceId ref, loc: {type:Point, coordinates:[lng,lat]}, speedKph, headingDeg, source: gps|simulated|manual, observedAt }` — `2dsphere` on loc, TTL optional via retention config, index `{ambulanceId, observedAt}`.

## hospitals / hospitalResources
- hospital: `{ name, districtId, loc Point, address, phone, departments: string[], specialties: string[], edTotal, icuTotal }` 2dsphere on loc.
- resource snapshot: `{ hospitalId, edAvailable, icuAvailable, ventilatorsAvailable, status: open|divert|full, reportedBy, reportedAt, source: reported|simulated }` index `{hospitalId, reportedAt}`. Freshness = now − reportedAt.

## incidents
`{ code unique (INC-...), category: accident|cardiac|maternal|pediatric|respiratory|trauma|other, priority: critical|urgent|routine, status: pending|assigned|acknowledged|enroute|onscene|onboard|athospital|handover|completed|cancelled, callerId ref users, contactPhone, loc Point + addressText, requiredCapabilities: string[], districtId, callbackAt, simulationOnly: true, idempotencyKey unique, timeline: [{at, by, event, detail}], createdAt }` — index `{status, districtId}`, 2dsphere loc, `{code}`.

## dispatchAssignments
`{ incidentId unique (one active), ambulanceId, strategy: nearest|min_eta|capability_traffic|manual, candidates: [{ambulanceId, distanceKm, etaSec, traffic, freshnessSec, eligible, exclusionReason?, explanation}], chosenId, status: proposed|approved|acknowledged|rejected|reassigned|completed, proposedBy, approvedBy, overrideReason?, createdAt }` index `{incidentId}`, `{ambulanceId, status}`.

## routes
`{ incidentId, assignmentId, from, to, path: [[lng,lat]], nodeIds: string[], costSec, distanceKm, nodesExplored, execMs, altCosts: number[], heuristic: string, valid: bool, closuresApplied: string[], source: astar|fallback, createdAt }`.

## trafficObservations / congestionPredictions
- obs: `{ segmentId, vehicleCount, avgSpeedKph, hour, source: observed|simulated, observedAt, loc? }` index `{segmentId, observedAt}`.
- pred: `{ segmentId, features, class: low|medium|high, proba: {low,medium,high}, modelVersion, source: predicted, createdAt }`.

## patientHandoffs
`{ incidentId, fromAmbulanceId, toHospitalId, vitals: {bp, pulse, spo2, rr, gcs, tempC}, notes: [{at, by, text}], summary, status: draft|notified|accepted|acknowledged|escalated, fictional: true }` — fictional data only.

## auditLogs / simulationScenarios / simulationEvents / modelEvaluations
- audit: `{ at, actorId, role, action, entity, entityId, detail, ip? }` index `{entity, entityId}`, `{at}`.
- scenario: `{ name, seed, config: {closures, congestion, breakdowns, capacity}, status: draft|running|paused|completed, createdBy }`.
- simEvent: `{ scenarioId, tick, at, kind, payload }` index `{scenarioId, tick}`.
- modelEval: `{ modelVersion, datasetHash, splitSeed, classDist, accuracy, perClass: {precision,recall,f1}, confusionMatrix, featureImportance, trainedAt }`.

## Seed (Anna Nagar demo)
District Chennai-Central; users for each role; AMB-A (BLS, near Anna Nagar, congested corridor), AMB-B (ALS, farther, free corridor), AMB-C (BLS, missing `ventilator`); hospital ` Govt Kilpauk (ED 5/20, ICU 2/8)`; graph nodes around Anna Nagar (8 nodes, 12 directed edges with coords); incident `INC-DEMO-001` accident/critical requiring `ventilator` → A,B eligible, C excluded.
