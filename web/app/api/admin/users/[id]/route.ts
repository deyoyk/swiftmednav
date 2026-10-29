import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { User, Audit } from "@/models";
import { getSession, requireRole } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["super_admin", "district_admin"];

const patchSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  role: z.string().min(1).optional(),
  districtId: z.string().min(1).optional(),
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

type SafeInput = Parameters<typeof toSafe>[0];

const SAFE_PROJECTION = "_id email name role phone districtId status orgId lang lastLoginAt createdAt";

function checkAuth(sess: { sub: string; role: string; districtId?: string } | null) {
  if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    requireRole(sess, ADMIN_ROLES);
  } catch {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const sess = await getSession();
  const denied = checkAuth(sess);
  if (denied) return denied;
  try {
    await db();
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
  const target = await User.findById(params.id).select(SAFE_PROJECTION).lean();
  if (!target) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const t = target as unknown as SafeInput & { districtId?: string };
  if (
    sess?.role === "district_admin" &&
    (t.districtId ?? "") !== (sess?.districtId ?? "")
  )
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, data: toSafe(t) });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const rl = rateLimit(`admin-users-patch:${clientKey(req)}`, 20, 60);
  if (!rl.allowed)
    return NextResponse.json({ ok: false, error: `rate limited, retry in ${rl.retryAfterSec}s` }, { status: 429 });
  const sess = await getSession();
  const denied = checkAuth(sess);
  if (denied) return denied;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid input" }, { status: 400 });
  if (Object.keys(parsed.data).length === 0)
    return NextResponse.json({ ok: false, error: "no fields to update" }, { status: 400 });
  try {
    await db();
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
  const target = await User.findById(params.id);
  if (!target) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  if (sess?.role === "district_admin") {
    if ((target.districtId ?? "") !== (sess?.districtId ?? ""))
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    if (parsed.data.role === "super_admin" || target.role === "super_admin")
      return NextResponse.json({ ok: false, error: "district_admin cannot manage super_admin" }, { status: 403 });
  }

  // Cannot suspend self
  if (String(target._id) === sess?.sub && parsed.data.status === "suspended")
    return NextResponse.json({ ok: false, error: "cannot suspend self" }, { status: 400 });

  // Cannot suspend/change the last active super_admin
  const demotingLastAdmin =
    target.role === "super_admin" &&
    target.status === "active" &&
    (parsed.data.status === "suspended" || (parsed.data.role !== undefined && parsed.data.role !== "super_admin"));
  if (demotingLastAdmin) {
    const remaining = await User.countDocuments({
      role: "super_admin",
      status: "active",
      _id: { $ne: target._id },
    });
    if (remaining === 0)
      return NextResponse.json({ ok: false, error: "cannot remove the last active super_admin" }, { status: 409 });
  }

  if (parsed.data.status !== undefined) target.status = parsed.data.status;
  if (parsed.data.role !== undefined) target.role = parsed.data.role;
  if (parsed.data.districtId !== undefined) target.districtId = parsed.data.districtId;
  await target.save();

  try {
    await Audit.create({
      actorId: sess?.sub,
      role: sess?.role,
      action: "user.update",
      entity: "User",
      entityId: String(target._id),
      detail: JSON.stringify(parsed.data),
    });
  } catch {
    // best-effort
  }
  const fresh = await User.findById(target._id).select(SAFE_PROJECTION).lean();
  return NextResponse.json({ ok: true, data: toSafe(fresh as unknown as SafeInput) });
}
