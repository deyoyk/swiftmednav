// Pure client-safe role constants (no next/headers — importable from "use client" components).
export const KNOWN_ROLES = [
  "super_admin",
  "district_admin",
  "dispatcher",
  "driver",
  "emt",
  "hospital_coordinator",
  "citizen",
] as const;

export type KnownRole = (typeof KNOWN_ROLES)[number];

export const ROLE_HOME: Record<string, string> = {
  dispatcher: "/dispatch",
  driver: "/driver",
  emt: "/emt",
  hospital_coordinator: "/hospital",
  citizen: "/request",
  super_admin: "/admin",
  district_admin: "/admin",
};
