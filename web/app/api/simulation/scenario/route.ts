import { NextResponse } from "next/server";
import { z } from "zod";
import { strategyCompare, setClosures, store } from "@/lib/store";
import { getSession, requireRole } from "@/lib/auth";
export async function GET() {
  return NextResponse.json({ ok: true, data: { compare: strategyCompare(), closures: store().closures, seed: 42, simulated: true } });
}
export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    requireRole(sess, ["dispatcher", "super_admin", "district_admin"]);
  } catch {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = z.object({ closures: z.array(z.string()).default([]), congestionMult: z.number().min(1).max(5).optional() }).parse(await req.json());
  const by = req.headers.get("x-actor") ?? "dispatcher";
  if (body.congestionMult) store().congestionMult = body.congestionMult;
  setClosures(body.closures, by);
  return NextResponse.json({ ok: true, data: { closures: store().closures, compare: strategyCompare() } });
}
