import { NextResponse } from "next/server";
import { z } from "zod";
import { approveAssignment } from "@/lib/store";
import { getSession, requireRole } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/ratelimit";
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const rl = rateLimit(`approve:${clientKey(req)}`, 30, 60);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: `rate limited, retry in ${rl.retryAfterSec}s` }, { status: 429 });
  const body = z.object({ vehicleId: z.string().optional(), overrideReason: z.string().optional() }).parse(await req.json().catch(() => ({})));
  const by = req.headers.get("x-actor") ?? "dispatcher";
  try {
    const sess = await getSession();
    if (!sess) throw Object.assign(new Error("unauthorized"), { status: 401 });
    requireRole(sess, ["dispatcher", "super_admin", "district_admin"]);
    return NextResponse.json({ ok: true, data: approveAssignment(params.code, body.vehicleId, body.overrideReason, by) });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: (e as { status?: number }).status ?? 400 });
  }
}
