import { NextResponse } from "next/server";
import { z } from "zod";
import { addComms } from "@/lib/store";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Ops log notes: written to the audit log + incident timeline,
// so they show up live on dispatch and analytics. Any signed-in role may send.
export async function POST(req: Request) {
  const sess = await getSession();
  if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = z.object({
    incidentCode: z.string().min(1),
    kind: z.enum(["contact", "roadblock", "note"]),
    text: z.string().max(500).default(""),
  }).parse(await req.json().catch(() => ({})));
  try {
    const e = addComms(body.incidentCode, body.kind, body.text, sess.role);
    return NextResponse.json({ ok: true, data: e });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: (err as { status?: number }).status ?? 400 });
  }
}
