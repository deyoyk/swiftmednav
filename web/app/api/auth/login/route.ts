import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { User } from "@/models";
import { signSession, verifyPw } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/ratelimit";
export async function POST(req: Request) {
  const rl = rateLimit(`login:${clientKey(req)}`, 10, 60);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: `rate limited, retry in ${rl.retryAfterSec}s` }, { status: 429 });
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(await req.json());
  await db();
  const u = await User.findOne({ email });
  if (!u || u.status !== "active" || !(await verifyPw(password, u.passwordHash))) return NextResponse.json({ ok: false, error: "invalid credentials" }, { status: 401 });
  const token = await signSession({ sub: String(u._id), role: u.role, districtId: u.districtId ?? "" });
  const res = NextResponse.json({ ok: true, data: { role: u.role, name: u.name } });
  res.cookies.set("smn_session", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 43200 });
  return res;
}
