import { NextResponse } from "next/server";
import { createIncident, store } from "@/lib/store";
import { incidentSchema } from "@/lib/validate";
import { rateLimit, clientKey } from "@/lib/ratelimit";
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const status = q.get("status");
  const priority = q.get("priority");
  const districtId = q.get("districtId");
  const text = (q.get("q") ?? "").toLowerCase();
  let incidents = [...store().incidents.values()];
  if (status) incidents = incidents.filter((i) => i.status === status);
  if (priority) incidents = incidents.filter((i) => i.priority === priority);
  if (districtId) incidents = incidents.filter((i) => i.districtId === districtId);
  if (text) incidents = incidents.filter((i) => `${i.code} ${i.category} ${i.addressText}`.toLowerCase().includes(text));
  return NextResponse.json({ ok: true, data: { incidents, simulated: true } });
}
export async function POST(req: Request) {
  const rl = rateLimit(`incidents:${clientKey(req)}`, 20, 60);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: `rate limited, retry in ${rl.retryAfterSec}s` }, { status: 429 });
  const body = incidentSchema.parse(await req.json());
  const inc = createIncident({
    category: body.category, priority: body.priority, contactPhone: body.contactPhone,
    addressText: body.addressText ?? `GPS ${body.lat?.toFixed(4)},${body.lng?.toFixed(4)} (SIMULATED)`,
    requiredCapabilities: body.requiredCapabilities,
  });
  return NextResponse.json({ ok: true, data: inc }, { status: 201 });
}
