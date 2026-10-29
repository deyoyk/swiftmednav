import { NextResponse } from "next/server";
import { z } from "zod";
import { store, setClosures, getRecommendations } from "@/lib/store";
import { getSession, requireRole } from "@/lib/auth";
export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("incident") ?? "INC-DEMO-001";
  return NextResponse.json({ ok: true, data: { route: store().routes.get(code) ?? getRecommendations().routes, recommend: getRecommendations(), simulated: true } });
}
export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    requireRole(sess, ["dispatcher", "super_admin", "district_admin"]);
  } catch {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = z.object({ incidentCode: z.string().default("INC-DEMO-001"), closures: z.array(z.string()).default([]) }).parse(await req.json());
  const by = req.headers.get("x-actor") ?? "dispatcher";
  const closures = setClosures(body.closures, by);
  return NextResponse.json({ ok: true, data: { closures, recommend: getRecommendations(), route: store().routes.get(body.incidentCode) ?? null } });
}
