import { NextResponse } from "next/server";
import { analytics, auditList, store } from "@/lib/store";
export async function GET(req: Request) {
  const seg = new URL(req.url).pathname.split("/").pop();
  if (seg === "export") {
    const a = analytics();
    const csv = ["metric,value", `incidents,${a.totals.incidents}`, `active,${a.totals.active}`, `availableAmbulances,${a.totals.availableAmbulances}`, `p50_min,${a.responseTimeMin.p50}`, `p90_min,${a.responseTimeMin.p90}`, `auditEvents,${a.auditCount}`].join("\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=swiftmednav-simulated.csv" } });
  }
  if (seg === "audit") return NextResponse.json({ ok: true, data: auditList() });
  if (seg === "hospital") return NextResponse.json({ ok: true, data: { ...store().hospital, simulated: true } });
  return NextResponse.json({ ok: true, data: analytics() });
}
