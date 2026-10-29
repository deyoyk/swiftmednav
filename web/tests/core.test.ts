import { describe, expect, it } from "vitest";
import { astar, GraphEdge, GraphNode } from "@/lib/graph";
import { demoEdges, demoNodes } from "@/lib/demoGraph";
import { recommend } from "@/lib/recommend";
import { canTransition } from "@/lib/validate";
import { createSim, replayMatchesSeed, simTick } from "@/lib/simulate";

describe("A* correctness", () => {
  it("finds optimal path on demo graph", () => {
    const r = astar(demoNodes, demoEdges, "A-base", "INC");
    expect(r.valid).toBe(true);
    expect(r.path[0]).toBe("A-base");
    expect(r.path[r.path.length - 1]).toBe("INC");
    expect(r.nodesExplored).toBeGreaterThan(0);
    expect(r.execMs).toBeGreaterThanOrEqual(0);
  });
  it("respects closures and falls back gracefully", () => {
    const closed = demoEdges.map((e) => (e.segId === "seg-a3-congested" && e.from === "N2" ? { ...e, closed: true } : e));
    const r = astar(demoNodes, closed, "A-base", "INC");
    expect(r.valid).toBe(true);
    expect(r.path.join()).not.toContain("N2>INC");
  });
  it("zero heuristic still finds a path (Dijkstra fallback)", () => {
    const r = astar(demoNodes, demoEdges, "A-base", "INC", { useZeroHeuristic: true });
    const full = astar(demoNodes, demoEdges, "A-base", "INC");
    expect(r.valid).toBe(true);
    expect(r.costSec).toBe(full.costSec);
  });
});

describe("recommendation", () => {
  const amb = [
    { id: "a", vehicleId: "AMB-A", type: "BLS", capabilities: ["oxygen", "ventilator"], status: "available", nodeId: "A-base", freshnessSec: 30 },
    { id: "b", vehicleId: "AMB-B", type: "ALS", capabilities: ["oxygen", "ventilator"], status: "available", nodeId: "B-base", freshnessSec: 40 },
    { id: "c", vehicleId: "AMB-C", type: "BLS", capabilities: ["oxygen"], status: "available", nodeId: "N1", freshnessSec: 20 },
  ];
  it("excludes incapable ambulance and prefers faster ETA under congestion", () => {
    const cong = new Map([["seg-a3-congested", { mult: 3, label: "high" as const }]]);
    const { candidates, top3 } = recommend(["ventilator"], "INC", amb, demoNodes, demoEdges, cong);
    const c = candidates.find((x) => x.vehicleId === "AMB-C")!;
    expect(c.eligible).toBe(false);
    expect(c.exclusionReason).toMatch(/ventilator/);
    // B farther but free; A congested 3x on final leg → B should win
    expect(top3[0]!.vehicleId).toBe("AMB-B");
  });
});

describe("state transitions", () => {
  it("allows legal chain, blocks skips", () => {
    expect(canTransition("pending", "assigned")).toBe(true);
    expect(canTransition("pending", "enroute")).toBe(false);
    expect(canTransition("enroute", "onscene")).toBe(true);
    expect(canTransition("handover", "completed")).toBe(true);
  });
});

describe("simulation determinism", () => {
  it("same seed replays identically", () => {
    expect(replayMatchesSeed(42, 10, ["A-base", "B-base"])).toBe(true);
  });
  it("ticks advance monotonically", () => {
    let s = createSim(7, ["A-base"]);
    s = simTick(s, new Map([["AMB-0", ["A-base", "N1", "N2", "INC"]]]));
    expect(s.tick).toBe(1);
    expect(s.events.length).toBe(2);
  });
});
