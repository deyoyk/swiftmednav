import { NextResponse } from "next/server";
import { analytics } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ ok: true, data: analytics() });
}
