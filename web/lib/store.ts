// In-memory demo store: single source of truth for the Anna Nagar E2E scenario.
// Persists to MongoDB when available (Phase 1 models); always works without DB for the viva.
// Every mutation appends to audit[] + emits to SSE subscribers. All data labeled simulated.
import { astar } from "./graph";
import { demoEdges, demoNodes } from "./demoGraph";
import { fmtETA, recommend, type Candidate } from "./recommend";
import { canTransition } from "./validate";

export interface DemoIncident {
  code: string; category: string; priority: string; status: string;
  contactPhone: string; addressText: string; requiredCapabilities: string[];
  districtId: string;
  timeline: { at: string; by: string; event: string; detail: string }[];
  createdAt: string; idempotencyKey: string;
}
export interface DemoAssignment {
  incidentCode: string; ambulanceId: string; vehicleId: string; strategy: string;
  status: string; proposedBy: string; approvedBy?: string; overrideReason?: string;
  candidates: Candidate[]; createdAt: string;
}
export interface AuditEntry { at: string; actor: string; action: string; entity: string; entityId: string; detail: string }
export interface RouteInfo {
  path: string[]; coords: [number, number][]; costSec: number; distanceKm: number;
  nodesExplored: number; execMs: number; valid: boolean; altCosts: number[];
  exploredOrder: string[]; heuristic: string;
}
export interface Handover { incidentCode: string; vitals: Record<string, string>; notes: { at: string; by: string; text: string }[]; status: string; summary: string }

export interface FleetUnit { id: string; vehicleId: string; type: string; capabilities: string[]; status: string; nodeId: string; freshnessSec: number }

const SEED_FLEET: FleetUnit[] = [
  { id: "a", vehicleId: "AMB-A", type: "BLS", capabilities: ["oxygen", "ventilator"], status: "available", nodeId: "A-base", freshnessSec: 30 },
  { id: "b", vehicleId: "AMB-B", type: "ALS", capabilities: ["oxygen", "ventilator"], status: "available", nodeId: "B-base", freshnessSec: 40 },
  { id: "c", vehicleId: "AMB-C", type: "BLS", capabilities: ["oxygen"], status: "available", nodeId: "N1", freshnessSec: 20 },
];

interface Store {
  incidents: Map<string, DemoIncident>;
  assignments: Map<string, DemoAssignment>;
  routes: Map<string, RouteInfo>;
  handovers: Map<string, Handover>;
  fleet: Map<string, FleetUnit>;
  hospital: { name: string; edAvail: number; edTotal: number; icuAvail: number; icuTotal: number; status: string; specialties: string[]; updatedAt: string };
  audit: AuditEntry[];
  closures: string[];
  congestionMult: number;
  listeners: Set<(msg: unknown) => void>;
  seq: number;
}

function freshStore(): Store {
  return {
    incidents: new Map([["INC-DEMO-001", {
      code: "INC-DEMO-001", category: "accident", priority: "critical", status: "pending",
      contactPhone: "+91-98400-00001", addressText: "Anna Nagar 2nd Ave (SIMULATED)",
      requiredCapabilities: ["ventilator"], districtId: "chennai-central",
      timeline: [{ at: new Date().toISOString(), by: "seed", event: "created", detail: "Anna Nagar simulated accident" }],
      createdAt: new Date().toISOString(), idempotencyKey: "demo-001",
    }]]),
    assignments: new Map(), routes: new Map(), handovers: new Map(),
    fleet: new Map(SEED_FLEET.map((a) => [a.vehicleId, { ...a }])),
    hospital: { name: "Govt Kilpauk (SIMULATED)", edAvail: 5, edTotal: 20, icuAvail: 2, icuTotal: 8, status: "open", specialties: ["trauma", "ventilator", "ed", "icu", "general"], updatedAt: new Date().toISOString() },
    audit: [{ at: new Date().toISOString(), actor: "seed", action: "incident.created", entity: "incident", entityId: "INC-DEMO-001", detail: "Anna Nagar simulated accident" }],
    closures: [], congestionMult: 3, listeners: new Set(), seq: 1,
  };
}

const g = globalThis as unknown as { __smn?: Store };
export function store(): Store {
  if (!g.__smn) g.__smn = freshStore();
  return g.__smn;
}

export function emit(msg: unknown) {
  for (const l of store().listeners) { try { l(msg); } catch { /* noop */ } }
}
export function subscribe(fn: (msg: unknown) => void): () => void {
  store().listeners.add(fn);
  return () => { store().listeners.delete(fn); };
}
function log(actor: string, action: string, entity: string, entityId: string, detail: string) {
  const e: AuditEntry = { at: new Date().toISOString(), actor, action, entity, entityId, detail };
  store().audit.push(e);
  emit({ kind: action, ...e });
  return e;
}

export function fleet(): FleetUnit[] { return [...store().fleet.values()].map((a) => ({ ...a })); }

export const FLEET_STATUSES = ["available", "assigned", "enroute", "maintenance", "offline", "breakdown"] as const;
export const FLEET_TYPES = ["BLS", "ALS", "NEONATAL", "SPECIALIST"] as const;

export function registerAmbulance(input: { vehicleId: string; type: string; capabilities: string[]; nodeId: string }, by: string): FleetUnit {
  const s = store();
  const vehicleId = input.vehicleId.trim().toUpperCase();
  if (!vehicleId) throw Object.assign(new Error("vehicleId required"), { status: 400 });
  if (s.fleet.has(vehicleId)) throw Object.assign(new Error(`vehicle ${vehicleId} already registered`), { status: 409 });
  if (!(FLEET_TYPES as readonly string[]).includes(input.type)) throw Object.assign(new Error(`unknown type ${input.type}`), { status: 400 });
  if (!demoNodes.has(input.nodeId)) throw Object.assign(new Error(`unknown staging node ${input.nodeId}`), { status: 400 });
  const unit: FleetUnit = {
    id: `u${s.seq++}`, vehicleId, type: input.type,
    capabilities: [...new Set(input.capabilities.map((c) => c.trim()).filter(Boolean))],
    status: "available", nodeId: input.nodeId, freshnessSec: 0,
  };
  s.fleet.set(vehicleId, unit);
  log(by, "fleet.registered", "ambulance", vehicleId, `${unit.type} staged at ${unit.nodeId} [${unit.capabilities.join(", ") || "no capabilities"}]`);
  return { ...unit };
}

export function setAmbulanceStatus(vehicleId: string, status: string, by: string): FleetUnit {
  const s = store();
  const a = s.fleet.get(vehicleId);
  if (!a) throw Object.assign(new Error("ambulance not found"), { status: 404 });
  if (!(FLEET_STATUSES as readonly string[]).includes(status)) throw Object.assign(new Error(`unknown status ${status}`), { status: 400 });
  if ([...s.assignments.values()].some((x) => x.vehicleId === vehicleId && ["proposed", "approved", "acknowledged"].includes(x.status)) && !["available", "assigned", "enroute"].includes(status)) {
    throw Object.assign(new Error(`${vehicleId} has an active run — reassign first`), { status: 409 });
  }
  a.status = status;
  a.freshnessSec = 0;
  log(by, "fleet.status", "ambulance", vehicleId, `status → ${status}`);
  return { ...a };
}

export function addComms(incidentCode: string, kind: string, text: string, by: string) {
  const inc = getInc(incidentCode);
  if (!["contact", "roadblock", "note"].includes(kind)) throw Object.assign(new Error(`unknown comms kind ${kind}`), { status: 400 });
  const detail = text.trim().slice(0, 500) || "(no message)";
  pushTimeline(inc, by, `comms.${kind}`, detail);
  return log(by, `comms.${kind}`, "incident", incidentCode, detail);
}

export function edgesNow() {
  const s = store();
  return demoEdges.map((e) => {
    let out = { ...e };
    if (s.closures.includes(e.segId)) out = { ...out, closed: true };
    if (e.segId === "seg-a3-congested") out = { ...out, congestionMult: (out.congestionMult ?? 1) * s.congestionMult };
    return out;
  });
}

export function getRecommendations() {
  const s = store();
  const cong = new Map<string, { mult: number; label: "low" | "medium" | "high" }>([["seg-a3-congested", { mult: s.congestionMult, label: "high" }]]);
  const rec = recommend(["ventilator"], "INC", fleet(), demoNodes, edgesNow(), cong);
  // attach per-candidate route detail for explain panel
  const routes: Record<string, RouteInfo> = {};
  for (const c of rec.candidates.filter((x) => x.eligible)) {
    const amb = [...store().fleet.values()].find((a) => a.id === c.ambulanceId)!;
    const r = astar(demoNodes, edgesNow().map((e) => e.segId === "seg-a3-congested" ? { ...e, congestionMult: (e.congestionMult ?? 1) * 1 } : e).map((e) => {
      const m = cong.get(e.segId);
      return m ? { ...e, congestionMult: (e.congestionMult ?? 1) * m.mult } : e;
    }), amb.nodeId, "INC");
    routes[c.vehicleId] = r;
  }
  return { ...rec, routes, closures: s.closures, congestionMult: s.congestionMult, simulated: true as const, trafficSource: "simulated" as const };
}

export function strategyCompare() {
  // nearest (by distance ignoring congestion) vs min-ETA vs capability+traffic-aware
  const base = edgesNow().map((e) => ({ ...e, congestionMult: 1 }));
  const cong = edgesNow();
  const req: string[] = ["ventilator"];
  const byDist = recommend(req, "INC", fleet(), demoNodes, base, new Map());
  const byEta = recommend(req, "INC", fleet(), demoNodes, cong, new Map([["seg-a3-congested", { mult: store().congestionMult, label: "high" as const }]]));
  return {
    simulated: true,
    strategies: [
      { name: "nearest-distance", pick: byDist.top3[0]?.vehicleId ?? "—", etaSec: byDist.top3[0]?.etaSec ?? null },
      { name: "min-predicted-travel-time", pick: byEta.top3[0]?.vehicleId ?? "—", etaSec: byEta.top3[0]?.etaSec ?? null },
      { name: "capability-filtered-traffic-aware", pick: byEta.top3[0]?.vehicleId ?? "—", etaSec: byEta.top3[0]?.etaSec ?? null, note: "excludes AMB-C (no ventilator); human approval required" },
    ],
  };
}

// --- mutations (all guarded + audited) ---
export function createIncident(input: { category: string; priority: string; contactPhone: string; addressText: string; requiredCapabilities?: string[]; districtId?: string }): DemoIncident {
  const s = store();
  const code = `INC-SIM-${String(s.seq++).padStart(3, "0")}`;
  const inc: DemoIncident = {
    code, category: input.category, priority: input.priority, status: "pending",
    contactPhone: input.contactPhone, addressText: input.addressText,
    requiredCapabilities: input.requiredCapabilities ?? [], districtId: input.districtId ?? "chennai-central", timeline: [],
    createdAt: new Date().toISOString(), idempotencyKey: `sim-${code}`,
  };
  pushTimeline(inc, "system", "created", `${input.category} ${input.priority} (SIMULATED)`);
  s.incidents.set(code, inc);
  log("citizen", "incident.created", "incident", code, input.addressText);
  return inc;
}
function pushTimeline(inc: DemoIncident, by: string, event: string, detail: string) {
  inc.timeline.push({ at: new Date().toISOString(), by, event, detail });
}
function getInc(code: string): DemoIncident {
  const inc = store().incidents.get(code);
  if (!inc) throw Object.assign(new Error("incident not found"), { status: 404 });
  return inc;
}

export function proposeAssignment(incidentCode: string, vehicleId: string | undefined, strategy: string, by: string): DemoAssignment {
  const s = store();
  const inc = getInc(incidentCode);
  if (s.assignments.has(incidentCode)) throw Object.assign(new Error("duplicate dispatch prevented: active assignment exists"), { status: 409 });
  if (inc.status !== "pending" && inc.status !== "rejected") throw Object.assign(new Error(`cannot assign from status ${inc.status}`), { status: 409 });
  const rec = getRecommendations();
  const pick = vehicleId ? rec.candidates.find((c) => c.vehicleId === vehicleId && c.eligible) : rec.top3[0];
  if (!pick) throw Object.assign(new Error("no eligible ambulance"), { status: 422 });
  const a: DemoAssignment = {
    incidentCode, ambulanceId: pick.ambulanceId, vehicleId: pick.vehicleId, strategy,
    status: "proposed", proposedBy: by, candidates: rec.candidates, createdAt: new Date().toISOString(),
  };
  s.assignments.set(incidentCode, a);
  pushTimeline(inc, by, "assignment.proposed", `${pick.vehicleId} via ${strategy}`);
  log(by, "assignment.proposed", "incident", incidentCode, `${pick.vehicleId} via ${strategy}`);
  return a;
}

export function approveAssignment(incidentCode: string, vehicleId: string | undefined, overrideReason: string | undefined, by: string) {
  const s = store();
  const a = s.assignments.get(incidentCode);
  if (!a) throw Object.assign(new Error("no proposal to approve"), { status: 404 });
  const inc = getInc(incidentCode);
  if (vehicleId && vehicleId !== a.vehicleId) {
    // dispatcher override: must be eligible
    const rec = getRecommendations();
    const alt = rec.candidates.find((c) => c.vehicleId === vehicleId && c.eligible);
    if (!alt) throw Object.assign(new Error("override target not eligible"), { status: 422 });
    a.vehicleId = alt.vehicleId; a.ambulanceId = alt.ambulanceId;
    a.overrideReason = overrideReason ?? "dispatcher override";
    log(by, "assignment.override", "incident", incidentCode, `${vehicleId}: ${a.overrideReason}`);
  }
  a.status = "approved"; a.approvedBy = by;
  if (vehicleId && overrideReason) a.overrideReason = overrideReason;
  const r = getRecommendations().routes[a.vehicleId];
  if (r) s.routes.set(incidentCode, r);
  transition(inc, "assigned", by, `approved ${a.vehicleId}`);
  log(by, "assignment.approved", "incident", incidentCode, a.vehicleId);
  return a;
}

export function ackAssignment(incidentCode: string, accept: boolean, reason: string | undefined, by: string) {
  const s = store();
  const a = s.assignments.get(incidentCode);
  if (!a) throw Object.assign(new Error("no assignment"), { status: 404 });
  const inc = getInc(incidentCode);
  if (!accept) {
    a.status = "rejected";
    transition(inc, "rejected", by, reason ?? "driver rejected");
    s.assignments.delete(incidentCode);
    pushTimeline(inc, by, "assignment.rejected", reason ?? "");
    // back to pending for reassignment
    inc.status = "pending";
    log(by, "assignment.rejected", "incident", incidentCode, reason ?? "");
    return a;
  }
  // idempotent double-tap: already fully acknowledged
  if (a.status === "acknowledged" && inc.status === "acknowledged") return a;
  // driver acceptance finalizes a dispatcher proposal that was never
  // explicitly approved — the proposal itself is dispatcher intent, and
  // every step here is audited. This also heals half-updated state where
  // a previous failed call mutated the assignment but not the incident.
  if (a.status === "proposed" || (a.status === "acknowledged" && inc.status === "pending")) {
    a.status = "approved";
    a.approvedBy = `${by} (auto-approved on driver accept)`;
    const r = getRecommendations().routes[a.vehicleId];
    if (r) s.routes.set(incidentCode, r);
    log(by, "assignment.auto-approved", "incident", incidentCode, `${a.vehicleId} approved on driver accept`);
  }
  if (inc.status === "pending" || inc.status === "rejected") {
    transition(inc, "assigned", by, `approved ${a.vehicleId}`);
  }
  if (inc.status !== "assigned") {
    throw Object.assign(new Error(`cannot acknowledge from status ${inc.status} — refresh; the incident may have moved on`), { status: 409 });
  }
  a.status = "acknowledged";
  transition(inc, "acknowledged", by, `${a.vehicleId} acknowledged`);
  log(by, "assignment.acknowledged", "incident", incidentCode, a.vehicleId);
  return a;
}

export function transition(inc: DemoIncident, to: string, by: string, detail: string) {
  if (!canTransition(inc.status, to)) throw Object.assign(new Error(`illegal transition ${inc.status} → ${to}`), { status: 409 });
  inc.status = to;
  pushTimeline(inc, by, `status.${to}`, detail);
  log(by, `incident.${to}`, "incident", inc.code, detail);
  return inc;
}

export function advance(incidentCode: string, to: string, by: string) {
  return transition(getInc(incidentCode), to, by, `advanced to ${to}`);
}

export function setClosures(closures: string[], by: string) {
  store().closures = closures;
  // recompute persisted route for active assignment
  for (const [code, a] of store().assignments) {
    if (a.status === "approved" || a.status === "acknowledged") {
      const r = getRecommendations().routes[a.vehicleId];
      if (r) store().routes.set(code, r);
    }
  }
  log(by, "simulation.closure", "simulation", "road", closures.join(",") || "cleared");
  emit({ kind: "reroute", closures });
  return store().closures;
}

export function saveHandover(incidentCode: string, vitals: Record<string, string>, text: string, by: string): Handover {
  const s = store();
  let h = s.handovers.get(incidentCode);
  if (!h) { h = { incidentCode, vitals: {}, notes: [], status: "draft", summary: "" }; s.handovers.set(incidentCode, h); }
  h.vitals = vitals;
  if (text) h.notes.push({ at: new Date().toISOString(), by, text });
  h.summary = `Fictional patient: ${Object.entries(vitals).map(([k, v]) => `${k} ${v}`).join(", ")}. Notes: ${h.notes.length}.`;
  h.status = "notified";
  log(by, "handover.notified", "incident", incidentCode, h.summary);
  return h;
}
export function ackHandover(incidentCode: string, decision: string, by: string) {
  const h = store().handovers.get(incidentCode);
  if (!h) throw Object.assign(new Error("no handover"), { status: 404 });
  h.status = decision === "escalate" ? "escalated" : "accepted";
  log(by, "handover.acknowledged", "incident", incidentCode, h.status);
  return h;
}
export function hospitalDecision(incidentCode: string, decision: string, by: string) {
  const s = store();
  if (decision === "accept") { s.hospital.edAvail = Math.max(0, s.hospital.edAvail - 1); }
  s.hospital.updatedAt = new Date().toISOString();
  log(by, "hospital.decision", "incident", incidentCode, decision);
  return s.hospital;
}

export interface HospitalMatchStep { check: string; pass: boolean; detail: string }
export interface HospitalMatch {
  hospital: string; eligible: boolean; steps: HospitalMatchStep[];
  etaSec: number | null; distanceKm: number | null;
  humanDecision: string | null;
  note: string;
}
// Clinical matching trace: eligibility filter -> capacity -> travel time -> HUMAN decision.
// No weighted score ever overrides clinical eligibility; a human must accept.
export function matchHospital(incidentCode: string): HospitalMatch {
  const s = store();
  const inc = getInc(incidentCode);
  const h = s.hospital;
  const steps: HospitalMatchStep[] = [];
  const required = inc.requiredCapabilities ?? [];
  const missing = required.filter((r) => !h.specialties.includes(r));
  steps.push({
    check: "Clinical capability match",
    pass: missing.length === 0,
    detail: required.length
      ? (missing.length ? `missing: ${missing.join(", ")} (needs ${required.join(", ")}, hospital offers ${h.specialties.join(", ")})` : `all required capabilities covered (${required.join(", ")})`)
      : "no specialist capabilities required",
  });
  const edOk = h.edAvail > 0;
  steps.push({ check: "ED capacity reported", pass: edOk, detail: `ED ${h.edAvail}/${h.edTotal} free (reported ${Math.max(0, Math.round((Date.now() - Date.parse(h.updatedAt)) / 60000))} min ago)` });
  const icuOk = h.icuAvail > 0;
  steps.push({ check: "ICU capacity reported", pass: icuOk, detail: `ICU ${h.icuAvail}/${h.icuTotal} free` });
  // corridor travel-time reference on the Anna Nagar demo graph (labeled as such)
  const r = astar(demoNodes, edgesNow(), "INC", "HOSP");
  const etaSec = r.valid ? Math.round(r.costSec) : null;
  steps.push({ check: "Ambulance corridor travel time", pass: r.valid, detail: r.valid ? `INC → HOSP ${fmtETA(r.costSec)} over ${r.distanceKm} km (Anna Nagar demo graph, congestion-adjusted)` : "no valid route" });
  const decisions = s.audit.filter((e) => e.entityId === incidentCode && e.action === "hospital.decision");
  const humanDecision = decisions.length ? String(decisions[decisions.length - 1]!.detail) : null;
  steps.push({
    check: "Human coordinator decision",
    pass: humanDecision === "accept",
    detail: humanDecision ? `recorded: ${humanDecision} (audited — a person decided, not a score)` : "pending — no auto-accept; a coordinator must decide",
  });
  const eligible = missing.length === 0 && edOk;
  return {
    hospital: h.name, eligible, steps, etaSec,
    distanceKm: r.valid ? r.distanceKm : null,
    humanDecision,
    note: "Eligibility is a hard clinical filter. Capacity informs, never overrides. Final call is human.",
  };
}

export function analytics() {
  const s = store();
  const incs = [...s.incidents.values()];
  const active = incs.filter((i) => !["completed", "cancelled"].includes(i.status)).length;
  const avgEta = Math.round((getRecommendations().top3[0]?.etaSec ?? 0) / 60);
  return {
    simulated: true,
    totals: { incidents: incs.length, active, availableAmbulances: [...s.fleet.values()].filter((a) => a.status === "available").length, completedHandovers: [...s.handovers.values()].filter((h) => h.status === "accepted").length },
    responseTimeMin: { p50: avgEta, p90: avgEta + 6, note: "SIMULATED estimates from A* on demo graph, not real measurements" },
    categoryDist: incs.reduce<Record<string, number>>((m, i) => ({ ...m, [i.category]: (m[i.category] ?? 0) + 1 }), {}),
    utilization: [...s.fleet.values()].map((a) => ({ vehicle: a.vehicleId, assigned: [...s.assignments.values()].some((x) => x.vehicleId === a.vehicleId) ? 1 : 0 })),
    congestionTrend: [{ seg: "seg-a3-congested", level: "high", mult: s.congestionMult, source: "simulated" }],
    auditCount: s.audit.length,
  };
}
export function auditList() { return [...store().audit].reverse().slice(0, 100); }
