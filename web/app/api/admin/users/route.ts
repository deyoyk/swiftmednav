import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { User, Audit } from "@/models";
import { getSession, requireRole, hashPw } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["super_admin", "district_admin"];
const CREATABLE_ROLES = [
  "district_admin",
  "dispatcher",
  "driver",
  "emt",
  "hospital_coordinator",
  "citizen",
  "super_admin",
] as const;

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(CREATABLE_ROLES),
  districtId: z.string().min(1).optional(),
  phone: z.string().optional(),
});

function toSafe(u: {
  _id: unknown;
  email: string;
  name: string;
  role: string;
  phone?: string;
  districtId?: string;
  status: string;
  orgId?: string;
  lang?: string;
  lastLoginAt?: Date;
  createdAt?: Date;
}): Record<string, unknown> {
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    role: u.role,
    phone: u.phone ?? null,
    districtId: u.districtId ?? null,
    status: u.status,
    orgId: u.orgId ?? null,
    lang: u.lang ?? "en",
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt ?? null,
  };
}

const SAFE_PROJECTION = "_id email name role phone districtId status orgId lang lastLoginAt createdAt";

export async function GET(req: Request) {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    requireRole(sess, ADMIN_ROLES);
  } catch {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  try {
    await db();
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
  const filter: Record<string, string> =
    sess.role === "district_admin" ? { districtId: sess.districtId ?? "" } : {};
  const users = await User.find(filter).select(SAFE_PROJECTION).lean();
  return NextResponse.json({
    ok: true,
    data: (users as unknown as Parameters<typeof toSafe>[0][]).map(toSafe),
  });
}

export async function POST(req: Request) {
  const rl = rateLimit(`admin-users:${clientKey(req)}`, 20, 60);
  if (!rl.allowed)
    return NextResponse.json({ ok: false, error: `rate limited, retry in ${rl.retryAfterSec}s` }, { status: 429 });
  const sess = await getSession();
  if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    requireRole(sess, ADMIN_ROLES);
  } catch {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" }, { status: 400 });
  const body = parsed.data;

  if (sess.role === "district_admin") {
    if (body.role === "super_admin")
      return NextResponse.json({ ok: false, error: "district_admin cannot grant super_admin" }, { status: 403 });
    const targetDistrict = body.districtId ?? sess.districtId ?? "";
    if (!targetDistrict || targetDistrict !== (sess.districtId ?? ""))
      return NextResponse.json({ ok: false, error: "district_admin can only create users in own district" }, { status: 403 });
  }

  try {
    await db();
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
  const email = body.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) return NextResponse.json({ ok: false, error: "email already exists" }, { status: 409 });
  const passwordHash = await hashPw(body.password);
  const doc = await User.create({
    email,
    name: body.name,
    passwordHash,
    role: body.role,
    districtId: body.districtId ?? sess.districtId ?? "",
    phone: body.phone ?? "",
    status: "active",
  });
  try {
    await Audit.create({
      actorId: sess.sub,
      role: sess.role,
      action: "user.create",
      entity: "User",
      entityId: String(doc._id),
      detail: `${body.role} ${email}`,
    });
  } catch {
    // best-effort: no-DB demo still works
  }
  const fresh = await User.findById(doc._id).select(SAFE_PROJECTION).lean();
  return NextResponse.json(
    { ok: true, data: toSafe(fresh as unknown as Parameters<typeof toSafe>[0]) },
    { status: 201 }
  );
}
