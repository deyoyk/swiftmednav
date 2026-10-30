import { describe, expect, it, beforeEach } from "vitest";
import { astar, astarTrace } from "@/lib/graph";
import { demoEdges, demoNodes } from "@/lib/demoGraph";
import { etaAnatomy } from "@/lib/anatomy";
import { hospitalDecision, matchHospital, store } from "@/lib/store";

function weighted(mult: number) {
  return demoEdges.map((e) => e.segId === "seg-a3-congested" ? { ...e, congestionMult: (e.congestionMult ?? 1) * mult } : e);
}

beforeEach(() => {
  const g = globalThis as unknown as { __smn?: unknown };
  delete g.__smn;
  store();
});

describe("A* trace explorer", () => {
  it("trace matches the real astar result (same path, same cost)", () => {
    const full = astar(demoNodes, demoEdges, "A-base", "INC");
    const t = astarTrace(demoNodes, demoEdges, "A-base", "INC");
    expect(t.valid).toBe(true);
    expect(t.path).toEqual(full.path);
    expect(t.costSec).toBe(full.costSec);
    expect(t.steps.length).toBeGreaterThan(0);
    expect(t.steps[0]!.current).toBe("A-base");
    expect(t.steps[t.steps.length - 1]!.current).toBe("INC");
    expect(t.finalG["INC"]).toBe(t.costSec);
  });
  it("Dijkstra (zero heuristic) finds the same optimal cost on the same graph", () => {
    const a = astar(demoNodes, demoEdges, "A-base", "INC");
    const d = astar(demoNodes, demoEdges, "A-base", "INC", { useZeroHeuristic: true });
    const ta = astarTrace(demoNodes, demoEdges, "A-base", "INC");
    const td = astarTrace(demoNodes, demoEdges, "A-base", "INC", { useZeroHeuristic: true });
    expect(d.costSec).toBe(a.costSec);
    expect(td.path).toEqual(ta.path);
    // heuristic is admissible: never exceeds the true remaining cost along the explored path
    expect(ta.steps.every((s) => s.f >= s.g)).toBe(true);
  });
});

describe("ETA anatomy", () => {
  it("components add up on the chosen path; closure penalty is non-negative", () => {
    const a = etaAnatomy(demoNodes, weighted(3), "B-base", "INC");
    expect(a.closed.valid).toBe(true);
    expect(a.open.valid).toBe(true);
    expect(a.closed.base + a.closed.congestion).toBe(a.closed.total);
    expect(a.open.base + a.open.congestion).toBe(a.open.total);
    expect(a.closurePenalty).toBeGreaterThanOrEqual(0);
  });
});

describe("hospital matching trace", () => {
  it("passes capability + capacity for the demo incident and records human decision", () => {
    const m0 = matchHospital("INC-DEMO-001");
    expect(m0.eligible).toBe(true);
    expect(m0.steps.length).toBe(5);
    expect(m0.etaSec).toBeGreaterThan(0);
    expect(m0.humanDecision).toBeNull();
    hospitalDecision("INC-DEMO-001", "accept", "hospital_coordinator");
    expect(matchHospital("INC-DEMO-001").humanDecision).toBe("accept");
  });
});
