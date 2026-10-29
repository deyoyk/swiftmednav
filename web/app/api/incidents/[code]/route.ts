import { NextResponse } from "next/server";
import { store, getRecommendations } from "@/lib/store";
export async function GET(_: Request, { params }: { params: { code: string } }) {
  const inc = store().incidents.get(params.code);
  if (!inc) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const assignment = store().assignments.get(params.code);
  const route = store().routes.get(params.code);
  const handover = store().handovers.get(params.code);
  return NextResponse.json({ ok: true, data: { incident: inc, assignment, route, handover, recommend: getRecommendations(), simulated: true } });
}
