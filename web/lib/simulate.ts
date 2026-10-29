// Deterministic simulation engine (seeded PRNG, tick-based, replayable).
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimEvent { tick: number; at: string; kind: string; payload: Record<string, unknown> }
export interface SimState {
  seed: number; tick: number; running: boolean;
  ambulances: { id: string; nodeId: string; progress: number }[];
  events: SimEvent[];
}

export function createSim(seed: number, ambulanceNodeIds: string[]): SimState {
  return { seed, tick: 0, running: false, ambulances: ambulanceNodeIds.map((nodeId, i) => ({ id: `AMB-${i}`, nodeId, progress: 0 })), events: [{ tick: 0, at: `t+0`, kind: "scenario.init", payload: { seed } }] };
}

export function simTick(s: SimState, routeByAmb: Map<string, string[]>): SimState {
  const rand = mulberry32(s.seed + s.tick);
  const ambulances = s.ambulances.map((a) => {
    const route = routeByAmb.get(a.id) ?? [a.nodeId];
    const idx = route.indexOf(a.nodeId);
    // advance with small jitter but deterministic per (seed,tick)
    const step = rand() > 0.3 ? 1 : 0;
    const next = route[Math.min(route.length - 1, idx + step)] ?? a.nodeId;
    return { ...a, nodeId: next, progress: route.length > 1 ? Math.min(1, (idx + step) / (route.length - 1)) : 1 };
  });
  const tick = s.tick + 1;
  return { ...s, tick, ambulances, events: [...s.events, { tick, at: `t+${tick}`, kind: "tick", payload: { positions: ambulances.map((a) => ({ id: a.id, node: a.nodeId })) } }] };
}

export function replayMatchesSeed(seed: number, steps: number, start: string[]): boolean {
  const routes = new Map<string, string[]>(start.map((n, i) => [`AMB-${i}`, [n, `${n}'`, "GOAL"]] as [string, string[]]));
  let a = createSim(seed, start);
  let b = createSim(seed, start);
  for (let i = 0; i < steps; i++) { a = simTick(a, routes); b = simTick(b, routes); }
  return JSON.stringify(a) === JSON.stringify(b);
}
