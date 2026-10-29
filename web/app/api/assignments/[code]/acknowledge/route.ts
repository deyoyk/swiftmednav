import { NextResponse } from "next/server";
import { z } from "zod";
import { ackAssignment } from "@/lib/store";
import { getSession, requireRole } from "@/lib/auth";
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const body = z.object({ accept: z.boolean(), reason: z.string().optional() }).parse(await req.json());
  const by = req.headers.get("x-actor") ?? "driver";
  try {
    const sess = await getSession();
    if (!sess) throw Object.assign(new Error("unauthorized"), { status: 401 });
    requireRole(sess, ["driver", "dispatcher", "super_admin", "district_admin"]);
    return NextResponse.json({ ok: true, data: ackAssignment(params.code, body.accept, body.reason, by) });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: (e as { status?: number }).status ?? 400 });
  }
}
