import { NextResponse } from "next/server";
import { z } from "zod";
import { advance } from "@/lib/store";
import { getSession, requireRole } from "@/lib/auth";
export async function PATCH(req: Request, { params }: { params: { code: string } }) {
  const { to } = z.object({ to: z.string().min(1) }).parse(await req.json());
  const by = req.headers.get("x-actor") ?? "dispatcher";
  try {
    const sess = await getSession();
    if (!sess) throw Object.assign(new Error("unauthorized"), { status: 401 });
    requireRole(sess, ["dispatcher", "driver", "emt", "super_admin", "district_admin"]);
    return NextResponse.json({ ok: true, data: advance(params.code, to, by) });
  } catch (e: unknown) {
    const status = (e as { status?: number }).status ?? 400;
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status });
  }
}
