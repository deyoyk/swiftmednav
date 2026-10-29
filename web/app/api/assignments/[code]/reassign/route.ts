import { NextResponse } from "next/server";
import { z } from "zod";
import { proposeAssignment, store } from "@/lib/store";
import { getSession, requireRole } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const body = z.object({ vehicleId: z.string(), reason: z.string().min(1) }).parse(await req.json());
  const by = req.headers.get("x-actor") ?? "dispatcher";
  try {
    const sess = await getSession();
    if (!sess) throw Object.assign(new Error("unauthorized"), { status: 401 });
    requireRole(sess, ["dispatcher", "super_admin", "district_admin"]);
    store().assignments.delete(params.code);
    const inc = store().incidents.get(params.code);
    if (inc) inc.status = "pending";
    return NextResponse.json({ ok: true, data: proposeAssignment(params.code, body.vehicleId, "manual-reassign", `${by} (${body.reason})`) });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: (e as { status?: number }).status ?? 400 });
  }
}
