import { NextResponse } from "next/server";
import { z } from "zod";
import { fleet, registerAmbulance, setAmbulanceStatus, FLEET_STATUSES, FLEET_TYPES } from "@/lib/store";
import { getSession, requireRole } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const OPS_ROLES = ["dispatcher", "super_admin", "district_admin"];

export async function GET() {
  return NextResponse.json({ ok: true, data: { ambulances: fleet(), simulated: true } });
}

export async function POST(req: Request) {
  const rl = rateLimit(`fleet:${clientKey(req)}`, 20, 60);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: `rate limited, retry in ${rl.retryAfterSec}s` }, { status: 429 });
  const sess = await getSession();
  if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    requireRole(sess, OPS_ROLES);
  } catch {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = z.object({
    vehicleId: z.string().min(1).max(20),
    type: z.enum(FLEET_TYPES as unknown as [string, ...string[]]),
    capabilities: z.array(z.string().min(1).max(40)).max(20).default([]),
    nodeId: z.string().min(1),
  }).parse(await req.json().catch(() => ({})));
  try {
    const unit = registerAmbulance(body, sess.role);
    return NextResponse.json({ ok: true, data: unit }, { status: 201 });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: (e as { status?: number }).status ?? 400 });
  }
}

export async function PATCH(req: Request) {
  const rl = rateLimit(`fleet:${clientKey(req)}`, 30, 60);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: `rate limited, retry in ${rl.retryAfterSec}s` }, { status: 429 });
  const sess = await getSession();
  if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    requireRole(sess, OPS_ROLES);
  } catch {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = z.object({
    vehicleId: z.string().min(1),
    status: z.enum(FLEET_STATUSES as unknown as [string, ...string[]]),
  }).parse(await req.json().catch(() => ({})));
  try {
    return NextResponse.json({ ok: true, data: setAmbulanceStatus(body.vehicleId, body.status, sess.role) });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: (e as { status?: number }).status ?? 400 });
  }
}
