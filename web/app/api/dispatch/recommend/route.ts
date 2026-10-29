import { NextResponse } from "next/server";
import { getRecommendations } from "@/lib/store";
// GET /api/dispatch/recommend — live store-backed recommendations (closures + congestion applied).
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ ok: true, data: getRecommendations() });
}
