// Real A* over a directed road graph. Edge costs = travel seconds (nonnegative).
// Heuristic: haversine(node, goal) / V_MAX_MPS (admissible). V_MAX = 22.2 m/s (~80 km/h).

export interface GraphNode { id: string; lng: number; lat: number }
export interface GraphEdge { from: string; to: string; segId: string; baseSec: number; congestionMult?: number; closed?: boolean; oneWay?: boolean }
export interface RouteResult {
  path: string[]; coords: [number, number][]; costSec: number; distanceKm: number;
  nodesExplored: number; execMs: number; valid: boolean; altCosts: number[];
  exploredOrder: string[]; heuristic: string;
}

const V_MAX_MPS = 22.2;
const R_EARTH_M = 6371000;

export function haversineM(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.sqrt(s1));
}

function edgeCost(e: GraphEdge): number {
  return Math.max(0, e.baseSec * (e.congestionMult ?? 1));
}

class MinHeap<T> {
  private a: { k: number; v: T }[] = [];
  get size() { return this.a.length; }
  push(k: number, v: T) {
    this.a.push({ k, v });
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p]!.k <= this.a[i]!.k) break;
      [this.a[p], this.a[i]] = [this.a[i]!, this.a[p]!];
      i = p;
    }
  }
  pop(): T | undefined {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length && last) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.a.length && this.a[l]!.k < this.a[m]!.k) m = l;
        if (r < this.a.length && this.a[r]!.k < this.a[m]!.k) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i]!, this.a[m]!];
        i = m;
      }
    }
    return top?.v;
  }
}

export function astar(
  nodes: Map<string, GraphNode>, edges: GraphEdge[], start: string, goal: string,
  opts: { useZeroHeuristic?: boolean } = {}
): RouteResult {
  const t0 = Date.now();
  const adj = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    if (e.closed) continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e);
  }
  const g = new Map<string, number>([[start, 0]]);
  const came = new Map<string, { prev: string; edge: GraphEdge }>();
  const open = new MinHeap<string>();
  const goalN = nodes.get(goal)!;
  const h = (id: string) => {
    if (opts.useZeroHeuristic) return 0;
    const n = nodes.get(id)!;
    return haversineM(n.lng, n.lat, goalN.lng, goalN.lat) / V_MAX_MPS;
  };
  open.push(h(start), start);
  const closed = new Set<string>();
  const exploredOrder: string[] = [];
  let nodesExplored = 0;

  while (open.size) {
    const cur = open.pop()!;
    if (closed.has(cur)) continue;
    closed.add(cur);
    exploredOrder.push(cur);
    nodesExplored++;
    if (cur === goal) break;
    for (const e of adj.get(cur) ?? []) {
      const ng = g.get(cur)! + edgeCost(e);
      if (ng < (g.get(e.to) ?? Infinity)) {
        g.set(e.to, ng);
        came.set(e.to, { prev: cur, edge: e });
        open.push(ng + h(e.to), e.to);
      }
    }
  }

  const execMs = Date.now() - t0;
  if (!g.has(goal) || (start !== goal && !came.has(goal))) {
    return { path: [], coords: [], costSec: Infinity, distanceKm: Infinity, nodesExplored, execMs, valid: false, altCosts: [], exploredOrder, heuristic: opts.useZeroHeuristic ? "zero (dijkstra fallback)" : `haversine/${V_MAX_MPS}mps` };
  }
  // reconstruct
  const path: string[] = [goal];
  let c = goal;
  let distanceKm = 0;
  while (c !== start) {
    const step = came.get(c)!;
    const a = nodes.get(step.prev)!, b = nodes.get(c)!;
    distanceKm += haversineM(a.lng, a.lat, b.lng, b.lat) / 1000;
    c = step.prev;
    path.unshift(c);
  }
  const coords = path.map((id) => { const n = nodes.get(id)!; return [n.lng, n.lat] as [number, number]; });
  const costSec = g.get(goal)!;
  // alternatives: penalize primary path edges (+50%) and re-run twice
  const primaryPairs = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) primaryPairs.add(`${path[i]}>${path[i + 1]}`);
  const altCosts: number[] = [];
  for (const penalty of [1.5, 2.5]) {
    const mod = edges.map((e) => primaryPairs.has(`${e.from}>${e.to}`) ? { ...e, baseSec: e.baseSec * penalty } : e);
    const r = astarRaw(nodes, mod, start, goal, opts);
    if (r.valid) altCosts.push(Math.round(r.costSec));
  }
  return { path, coords, costSec: Math.round(costSec), distanceKm: Math.round(distanceKm * 100) / 100, nodesExplored, execMs, valid: true, altCosts, exploredOrder, heuristic: opts.useZeroHeuristic ? "zero (dijkstra fallback)" : `haversine/${V_MAX_MPS}mps` };
}

function astarRaw(nodes: Map<string, GraphNode>, edges: GraphEdge[], start: string, goal: string, opts: { useZeroHeuristic?: boolean }) {
  // penalty-run without recursive alternatives
  const t0 = Date.now();
  const adj = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    if (e.closed) continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e);
  }
  const g = new Map<string, number>([[start, 0]]);
  const open = new MinHeap<string>();
  const goalN = nodes.get(goal)!;
  const h = (id: string) => {
    if (opts.useZeroHeuristic) return 0;
    const n = nodes.get(id)!;
    return haversineM(n.lng, n.lat, goalN.lng, goalN.lat) / V_MAX_MPS;
  };
  open.push(h(start), start);
  const closed = new Set<string>();
  while (open.size) {
    const cur = open.pop()!;
    if (closed.has(cur)) continue;
    closed.add(cur);
    if (cur === goal) break;
    for (const e of adj.get(cur) ?? []) {
      const ng = g.get(cur)! + edgeCost(e);
      if (ng < (g.get(e.to) ?? Infinity)) { g.set(e.to, ng); open.push(ng + h(e.to), e.to); }
    }
  }
  return { valid: g.has(goal), costSec: g.get(goal) ?? Infinity };
}
