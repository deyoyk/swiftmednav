import { describe, expect, it, beforeEach } from "vitest";
import { addComms, fleet, proposeAssignment, registerAmbulance, setAmbulanceStatus, store } from "@/lib/store";

beforeEach(() => {
  const g = globalThis as unknown as { __smn?: unknown };
  delete g.__smn;
  store();
});

describe("fleet management", () => {
  it("registers a unit that immediately appears in recommendations", () => {
    const u = registerAmbulance({ vehicleId: "AMB-D", type: "NEONATAL", capabilities: ["oxygen", "incubator"], nodeId: "HOSP" }, "dispatcher");
    expect(u.vehicleId).toBe("AMB-D");
    expect(fleet().some((a) => a.vehicleId === "AMB-D")).toBe(true);
  });
  it("rejects duplicates and bad input", () => {
    expect(() => registerAmbulance({ vehicleId: "AMB-A", type: "BLS", capabilities: [], nodeId: "N1" }, "d")).toThrow(/already registered/);
    expect(() => registerAmbulance({ vehicleId: "AMB-Z", type: "JET", capabilities: [], nodeId: "N1" }, "d")).toThrow(/unknown type/);
    expect(() => registerAmbulance({ vehicleId: "AMB-Z", type: "BLS", capabilities: [], nodeId: "NOWHERE" }, "d")).toThrow(/unknown staging node/);
  });
  it("changes status and blocks standing down a unit on an active run", () => {
    setAmbulanceStatus("AMB-C", "maintenance", "dispatcher");
    expect(fleet().find((a) => a.vehicleId === "AMB-C")!.status).toBe("maintenance");
    proposeAssignment("INC-DEMO-001", "AMB-B", "s", "dispatcher");
    expect(() => setAmbulanceStatus("AMB-B", "maintenance", "dispatcher")).toThrow(/active run/);
    expect(() => setAmbulanceStatus("AMB-X", "available", "dispatcher")).toThrow(/not found/);
  });
});

describe("comms log", () => {
  it("writes to audit timeline and audit log", () => {
    const e = addComms("INC-DEMO-001", "note", "hello dispatch", "driver");
    expect(e.action).toBe("comms.note");
    expect(store().incidents.get("INC-DEMO-001")!.timeline.some((t) => t.event === "comms.note")).toBe(true);
    expect(() => addComms("INC-DEMO-001", "yell", "x", "driver")).toThrow(/unknown comms kind/);
    expect(() => addComms("NOPE-1", "note", "x", "driver")).toThrow(/not found/);
  });
});
