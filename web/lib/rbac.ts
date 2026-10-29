import { getSession } from "@/lib/auth";
import { KNOWN_ROLES, type KnownRole } from "@/lib/roles";

export type { KnownRole };
export { KNOWN_ROLES };
export { ROLE_HOME } from "@/lib/roles";

export interface SessionInfo {
  sub: string;
  role: string;
  districtId?: string;
}

const DISPATCHER_PREFIXES = ["/dispatch", "/fleet", "/simulation", "/analytics", "/explain", "/request"];
const PUBLIC_PREFIXES = ["/login"];

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => matches(pathname, p));
}

export function canAccess(role: string, pathname: string): boolean {
  if (isPublic(pathname)) return true;
  if (role === "super_admin") return true;
  if (role === "district_admin") return true;
  if (!(KNOWN_ROLES as readonly string[]).includes(role)) return false;
  switch (role) {
    case "dispatcher":
      return DISPATCHER_PREFIXES.some((p) => matches(pathname, p));
    case "driver":
      return matches(pathname, "/driver");
    case "emt":
      return matches(pathname, "/emt");
    case "hospital_coordinator":
      return matches(pathname, "/hospital");
    case "citizen":
      return matches(pathname, "/request");
    default:
      return false;
  }
}

export function inDistrict(sess: SessionInfo | null, districtId: string | undefined): boolean {
  if (!sess) return false;
  if (sess.role === "super_admin") return true;
  if (sess.role === "district_admin" || sess.role === "dispatcher") {
    if (!districtId) return false;
    return (sess.districtId ?? "") !== "" && sess.districtId === districtId;
  }
  return false;
}

function toSessionInfo(sess: { sub: string; role: string; districtId?: string }): SessionInfo {
  return { sub: sess.sub, role: sess.role, districtId: sess.districtId };
}

export async function requireSession(_req?: Request): Promise<SessionInfo> {
  const sess = await getSession();
  if (!sess) throw Object.assign(new Error("unauthorized"), { status: 401 });
  return toSessionInfo(sess);
}

export async function withRole(_req: Request, roles: string[]): Promise<SessionInfo> {
  const sess = await getSession();
  if (!sess) throw Object.assign(new Error("unauthorized"), { status: 401 });
  if (!roles.includes(sess.role ?? "")) throw Object.assign(new Error("forbidden"), { status: 403 });
  return toSessionInfo(sess);
}
