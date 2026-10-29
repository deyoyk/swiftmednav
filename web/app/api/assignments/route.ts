import { NextResponse } from "next/server";
import { z } from "zod";
import { proposeAssignment } from "@/lib/store";
export async function POST(req: Request) {
  const body = z.object({ incidentCode: z.string(), vehicleId: z.string().optional(), strategy: z.string().default("capability-filtered-traffic-aware") }).parse(await req.json());
  const by = req.headers.get("x-actor") ?? "dispatcher";
  try {
    return NextResponse.json({ ok: true, data: proposeAssignment(body.incidentCode, body.vehicleId, body.strategy, by) }, { status: 201 });
  } catch (e: unknown) {
    const status = (e as { status?: number }).status ?? 400;
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status });
  }
}
