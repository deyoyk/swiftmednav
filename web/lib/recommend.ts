// Capability-filtered, traffic-aware ambulance recommendation.
// Never dispatches on ML alone: ML only scales edge congestion; human approval required.
import { astar, GraphEdge, GraphNode } from "./graph";

export interface Candidate {
  ambulanceId: string; vehicleId: string; type: string;
  eligible: boolean; exclusionReason?: string;
  distanceKm?: number; etaSec?: number; traffic?: "low" | "medium" | "high" | "unknown";
  freshnessSec?: number; explanation?: string;
}

export interface AmbulanceInput {
  id: string; vehicleId: string; type: string; capabilities: string[];
  status: string; nodeId: string; freshnessSec: number;
}

export function recommend(
  required: string[],
  incidentNodeId: string,
  ambulances: AmbulanceInput[],
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  congestionBySeg: Map<string, { mult: number; label: "low" | "medium" | "high" }>
): { candidates: Candidate[]; top3: Candidate[] } {
  const out: Candidate[] = [];
  for (const a of ambulances) {
    if (a.status !== "available") {
      out.push({ ambulanceId: a.id, vehicleId: a.vehicleId, type: a.type, eligible: false, exclusionReason: `status=${a.status} (not available)` });
      continue;
    }
    const missing = required.filter((r) => !a.capabilities.includes(r));
    if (missing.length) {
      out.push({ ambulanceId: a.id, vehicleId: a.vehicleId, type: a.type, eligible: false, exclusionReason: `missing capability: ${missing.join(", ")}` });
      continue;
    }
    const weighted = edges.map((e) => {
      const c = congestionBySeg.get(e.segId);
      return c ? { ...e, congestionMult: (e.congestionMult ?? 1) * c.mult } : e;
    });
    const r = astar(nodes, weighted, a.nodeId, incidentNodeId);
    if (!r.valid) {
      out.push({ ambulanceId: a.id, vehicleId: a.vehicleId, type: a.type, eligible: false, exclusionReason: "no valid route (graph disconnected or closures)" });
      continue;
    }
    const worstMult = Math.max(1, ...weighted.filter((e) => r.path.includes(e.from)).map((e) => e.congestionMult ?? 1));
    const traffic = worstMult >= 2 ? "high" : worstMult >= 1.35 ? "medium" : "low";
    const stale = a.freshnessSec > 300 ? ` Location stale (${Math.round(a.freshnessSec / 60)} min old).` : "";
    out.push({
      ambulanceId: a.id, vehicleId: a.vehicleId, type: a.type, eligible: true,
      distanceKm: r.distanceKm, etaSec: r.costSec, traffic, freshnessSec: a.freshnessSec,
      explanation: `A* ETA ${fmtETA(r.costSec)} over ${r.distanceKm} km (${r.nodesExplored} nodes explored). Traffic ${traffic} on corridor. Capability match ✓.${stale} Human approval required.`
    });
  }
  const ranked = out.filter((c) => c.eligible).sort((x, y) => (x.etaSec ?? Infinity) - (y.etaSec ?? Infinity));
  // attach rank reason for top pick
  if (ranked[0] && ranked[1]) {
    ranked[0]!.explanation += ` Ranked #1: ${Math.round((ranked[1]!.etaSec! - ranked[0]!.etaSec!) / 60)} min faster than ${ranked[1]!.vehicleId} despite distance.`;
  }
  return { candidates: [...ranked, ...out.filter((c) => !c.eligible)], top3: ranked.slice(0, 3) };
}

export function fmtETA(sec: number): string {
  if (!isFinite(sec)) return "—";
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
