// ETA anatomy: splits a travel-time estimate into honest, additive components
// computed with the SAME A* engine as dispatch. No new models, no estimates
// invented outside the road graph.
import { astar } from "./graph";
import type { GraphEdge, GraphNode } from "./graph";

export interface CostSplit {
  /** free-flow seconds over the chosen path (congestion multipliers stripped) */
  base: number;
  /** extra seconds from traffic on that same path (>= 0 by construction) */
  congestion: number;
  total: number;
  path: string[];
  valid: boolean;
}

export interface EtaAnatomy {
  /** best route if every road were open (hypothetical reference) */
  open: CostSplit;
  /** best route with real closures applied (what dispatch actually uses) */
  closed: CostSplit;
  /** detour cost imposed by closures (>= 0) */
  closurePenalty: number;
}

function splitPathCost(edges: GraphEdge[], path: string[]): { base: number; congestion: number; total: number } {
  let base = 0;
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const hops = edges.filter((e) => e.from === path[i] && e.to === path[i + 1] && !e.closed);
    if (!hops.length) return { base: NaN, congestion: NaN, total: Infinity };
    const e = hops.reduce((m, x) => (x.baseSec * (x.congestionMult ?? 1) < m.baseSec * (m.congestionMult ?? 1) ? x : m));
    base += e.baseSec;
    total += e.baseSec * (e.congestionMult ?? 1);
  }
  return { base: Math.round(base), congestion: Math.round(total - base), total: Math.round(total) };
}

function splitFor(nodes: Map<string, GraphNode>, edges: GraphEdge[], from: string, to: string): CostSplit {
  const r = astar(nodes, edges, from, to);
  if (!r.valid) return { base: 0, congestion: 0, total: Infinity, path: [], valid: false };
  const c = splitPathCost(edges, r.path);
  return { base: c.base, congestion: c.congestion, total: c.total, path: r.path, valid: true };
}

export function etaAnatomy(
  nodes: Map<string, GraphNode>, edges: GraphEdge[],
  from: string, to: string
): EtaAnatomy {
  const openEdges = edges.map((e) => ({ ...e, closed: false }));
  const open = splitFor(nodes, openEdges, from, to);
  const closed = splitFor(nodes, edges, from, to);
  const closurePenalty = open.valid && closed.valid ? Math.max(0, closed.total - open.total) : 0;
  return { open, closed, closurePenalty };
}
