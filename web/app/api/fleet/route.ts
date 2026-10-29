import { NextResponse } from "next/server";
import { fleet } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ ok: true, data: { ambulances: fleet(), simulated: true } });
}
