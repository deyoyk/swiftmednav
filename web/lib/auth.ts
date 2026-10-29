import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret-change-me-32chars!!!");
export async function hashPw(pw: string) { return bcrypt.hash(pw, 10); }
export async function verifyPw(pw: string, h: string) { return bcrypt.compare(pw, h); }
export async function signSession(payload: Record<string, string>) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime("12h").sign(secret);
}
export async function getSession() {
  try {
    const c = cookies().get("smn_session")?.value;
    if (!c) return null;
    const { payload } = await jwtVerify(c, secret);
    return payload as { sub: string; role: string; districtId?: string };
  } catch { return null; }
}
export function requireRole(sess: { role?: string } | null, roles: string[]) {
  if (!sess || !roles.includes(sess.role ?? "")) throw Object.assign(new Error("forbidden"), { status: 403 });
}
