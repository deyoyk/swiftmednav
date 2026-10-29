import { NextResponse } from "next/server";
import { z } from "zod";
import { saveHandover } from "@/lib/store";
export async function POST(req: Request) {
  const body = z.object({ incidentCode: z.string(), vitals: z.record(z.string()).default({}), note: z.string().default("") }).parse(await req.json());
  const by = req.headers.get("x-actor") ?? "emt";
  return NextResponse.json({ ok: true, data: saveHandover(body.incidentCode, body.vitals, body.note, by) });
}
