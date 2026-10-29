import { describe, expect, it, beforeEach } from "vitest";
import { createIncident, proposeAssignment, approveAssignment, ackAssignment, advance, setClosures, store } from "@/lib/store";

beforeEach(() => {
  // reset singleton between tests
  const g = globalThis as unknown as { __smn?: unknown };
  delete g.__smn;
  store();
});

describe("dispatch state machine (E2E store)", () => {
  it("full happy path: propose → approve → ack → enroute → … → completed", () => {
    const p = proposeAssignment("INC-DEMO-001", "AMB-B", "capability-filtered-traffic-aware", "dispatcher");
    expect(p.vehicleId).toBe("AMB-B");
    approveAssignment("INC-DEMO-001", undefined, undefined, "dispatcher");
    ackAssignment("INC-DEMO-001", true, undefined, "driver");
    for (const to of ["enroute", "onscene", "onboard", "athospital", "handover", "completed"]) advance("INC-DEMO-001", to, "driver");
    expect(store().incidents.get("INC-DEMO-001")!.status).toBe("completed");
    expect(store().audit.length).toBeGreaterThan(5);
  });
  it("prevents duplicate assignment (atomic guard)", () => {
    proposeAssignment("INC-DEMO-001", "AMB-B", "s", "dispatcher");
    expect(() => proposeAssignment("INC-DEMO-001", "AMB-A", "s", "dispatcher")).toThrow(/duplicate/);
  });
  it("rejects illegal transitions", () => {
    expect(() => advance("INC-DEMO-001", "enroute", "driver")).toThrow(/illegal/);
  });
  it("reject returns incident to pending for reassignment", () => {
    proposeAssignment("INC-DEMO-001", "AMB-B", "s", "dispatcher");
    approveAssignment("INC-DEMO-001", undefined, undefined, "dispatcher");
    ackAssignment("INC-DEMO-001", false, "low fuel", "driver");
    expect(store().incidents.get("INC-DEMO-001")!.status).toBe("pending");
    const p2 = proposeAssignment("INC-DEMO-001", "AMB-A", "manual-reassign", "dispatcher");
    expect(p2.vehicleId).toBe("AMB-A");
  });
  it("override to ineligible ambulance is rejected", () => {
    proposeAssignment("INC-DEMO-001", "AMB-B", "s", "dispatcher");
    expect(() => approveAssignment("INC-DEMO-001", "AMB-C", "oops", "dispatcher")).toThrow(/not eligible/);
  });
  it("driver accept without explicit approve self-heals (auto-approve)", () => {
    proposeAssignment("INC-DEMO-001", "AMB-B", "s", "dispatcher");
    const a = ackAssignment("INC-DEMO-001", true, undefined, "driver");
    expect(a.status).toBe("acknowledged");
    expect(store().incidents.get("INC-DEMO-001")!.status).toBe("acknowledged");
    // double-tap is idempotent, not an error
    expect(ackAssignment("INC-DEMO-001", true, undefined, "driver").status).toBe("acknowledged");
  });
  it("closure reroute keeps assignment routable", () => {
    proposeAssignment("INC-DEMO-001", "AMB-B", "s", "dispatcher");
    approveAssignment("INC-DEMO-001", undefined, undefined, "dispatcher");
    setClosures(["seg-a3-congested"], "dispatcher");
    const r = store().routes.get("INC-DEMO-001");
    expect(r?.valid).toBe(true);
  });
});
