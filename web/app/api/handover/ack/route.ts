import { NextResponse } from "next/server";
import { z } from "zod";
import { ackHandover, hospitalDecision } from "@/lib/store";
import { getSession, requireRole } from "@/lib/auth";
export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  try {
    requireRole(sess, ["hospital_coordinator", "emt", "dispatcher", "super_admin", "district_admin"]);
  } catch {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = z.object({ incidentCode: z.string(), decision: z.enum(["accept", "escalate"]) }).parse(await req.json());
  const by = req.headers.get("x-actor") ?? "hospital_coordinator";
  const url = new URL(req.url);
  if (url.searchParams.get("kind") === "bed") return NextResponse.json({ ok: true, data: hospitalDecision(body.incidentCode, body.decision, by) });
  return NextResponse.json({ ok: true, data: ackHandover(body.incidentCode, body.decision, by) });
}
