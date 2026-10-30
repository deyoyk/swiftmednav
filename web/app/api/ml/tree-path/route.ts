import { NextResponse } from "next/server";
import { z } from "zod";
const MODEL = { modelVersion: "rf-v1-seed42", synthetic: true, provenance: "synthetic generator (seed 42), NOT real traffic. Demo only." };
export const dynamic = "force-dynamic";
// Proxies FastAPI /tree-path (real decision paths through trained trees) with validation + timeout.
export async function POST(req: Request) {
  const f = z.object({ vehicle_count: z.number().int().min(0).max(500), avg_speed: z.number().min(0).max(120), hour: z.number().int().min(0).max(23), n_trees: z.number().int().min(1).max(5).default(3) }).parse(await req.json());
  const base = process.env.ML_URL ?? "http://127.0.0.1:8001";
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch(`${base}/tree-path?n_trees=${f.n_trees}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicle_count: f.vehicle_count, avg_speed: f.avg_speed, hour: f.hour }), signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (r.ok) return NextResponse.json({ ok: true, data: await r.json() });
    if (r.status === 503) return NextResponse.json({ ok: false, error: "trained forest unavailable — train via ml-service/train.py and restart the ML service", ...MODEL }, { status: 503 });
  } catch { /* fallback below */ }
  return NextResponse.json({ ok: false, error: "FastAPI unreachable — start it with: uvicorn app:app --port 8001 (in ml-service/)", ...MODEL }, { status: 502 });
}
