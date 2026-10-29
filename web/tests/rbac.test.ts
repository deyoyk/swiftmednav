import { describe, expect, it } from "vitest";
import { ROLE_HOME, canAccess, inDistrict } from "@/lib/rbac";

describe("ROLE_HOME", () => {
  it("gives every known role a home", () => {
    for (const role of [
      "super_admin",
      "district_admin",
      "dispatcher",
      "driver",
      "emt",
      "hospital_coordinator",
      "citizen",
    ]) {
      expect(ROLE_HOME[role]).toBeTypeOf("string");
      expect(ROLE_HOME[role]).toMatch(/^\//);
    }
  });
  it("maps to the expected homes", () => {
    expect(ROLE_HOME["dispatcher"]).toBe("/dispatch");
    expect(ROLE_HOME["driver"]).toBe("/driver");
    expect(ROLE_HOME["emt"]).toBe("/emt");
    expect(ROLE_HOME["hospital_coordinator"]).toBe("/hospital");
    expect(ROLE_HOME["citizen"]).toBe("/request");
    expect(ROLE_HOME["super_admin"]).toBe("/admin");
    expect(ROLE_HOME["district_admin"]).toBe("/admin");
  });
});

describe("canAccess", () => {
  it("denies dispatcher access to /admin", () => {
    expect(canAccess("dispatcher", "/admin")).toBe(false);
    expect(canAccess("dispatcher", "/admin/users")).toBe(false);
  });
  it("denies citizen access to /dispatch", () => {
    expect(canAccess("citizen", "/dispatch")).toBe(false);
  });
  it("allows driver on /driver", () => {
    expect(canAccess("driver", "/driver")).toBe(true);
    expect(canAccess("driver", "/driver/jobs")).toBe(true);
    expect(canAccess("driver", "/dispatch")).toBe(false);
  });
  it("allows super_admin everywhere", () => {
    for (const p of ["/admin", "/dispatch", "/driver", "/emt", "/hospital", "/request", "/fleet", "/analytics"]) {
      expect(canAccess("super_admin", p)).toBe(true);
    }
  });
  it("denies unknown roles on app paths", () => {
    expect(canAccess("ghost", "/dispatch")).toBe(false);
    expect(canAccess("", "/admin")).toBe(false);
  });
  it("keeps public paths open", () => {
    expect(canAccess("ghost", "/login")).toBe(true);
    expect(canAccess("citizen", "/")).toBe(true);
  });
  it("enforces dispatcher matrix", () => {
    for (const p of ["/dispatch", "/fleet", "/simulation", "/analytics", "/explain", "/request"]) {
      expect(canAccess("dispatcher", p)).toBe(true);
    }
    expect(canAccess("dispatcher", "/hospital")).toBe(false);
    expect(canAccess("dispatcher", "/emt")).toBe(false);
  });
  it("enforces emt / hospital / citizen scopes", () => {
    expect(canAccess("emt", "/emt")).toBe(true);
    expect(canAccess("emt", "/driver")).toBe(false);
    expect(canAccess("hospital_coordinator", "/hospital")).toBe(true);
    expect(canAccess("hospital_coordinator", "/dispatch")).toBe(false);
    expect(canAccess("citizen", "/request")).toBe(true);
    expect(canAccess("citizen", "/hospital")).toBe(false);
  });
});

describe("inDistrict", () => {
  it("super_admin is always in district", () => {
    expect(inDistrict({ sub: "1", role: "super_admin" }, "d1")).toBe(true);
    expect(inDistrict({ sub: "1", role: "super_admin" }, undefined)).toBe(true);
  });
  it("district_admin and dispatcher match own district", () => {
    expect(inDistrict({ sub: "1", role: "district_admin", districtId: "d1" }, "d1")).toBe(true);
    expect(inDistrict({ sub: "1", role: "district_admin", districtId: "d1" }, "d2")).toBe(false);
    expect(inDistrict({ sub: "1", role: "dispatcher", districtId: "d1" }, "d1")).toBe(true);
    expect(inDistrict({ sub: "1", role: "dispatcher", districtId: "d1" }, "d2")).toBe(false);
  });
  it("returns false for null session or missing district", () => {
    expect(inDistrict(null, "d1")).toBe(false);
    expect(inDistrict({ sub: "1", role: "district_admin" }, "d1")).toBe(false);
    expect(inDistrict({ sub: "1", role: "driver", districtId: "d1" }, "d1")).toBe(false);
  });
});
