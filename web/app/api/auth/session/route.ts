import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ ok: false, error: "signed out" }, { status: 401 });
  return NextResponse.json({ ok: true, data: s });
}
export async function POST() {
  const r = NextResponse.json({ ok: true });
  r.cookies.set("smn_session", "", { maxAge: 0, path: "/" });
  return r;
}
