import { NextResponse } from "next/server";
import { z } from "zod";
const MODEL = { modelVersion: "rf-v1-seed42", synthetic: true, provenance: "synthetic generator (seed 42), NOT real traffic. Demo only." };
function localPredict(f: { vehicle_count: number; avg_speed: number; hour: number }) {
  const cls = f.avg_speed < 15 || f.vehicle_count > 120 ? "high" : f.avg_speed < 28 || f.vehicle_count > 60 ? "medium" : "low";
  const proba = cls === "high" ? { low: 0.05, medium: 0.15, high: 0.8 } : cls === "medium" ? { low: 0.15, medium: 0.7, high: 0.15 } : { low: 0.8, medium: 0.15, high: 0.05 };
  return { class: cls, probabilities: proba, ...MODEL, source: "predicted" as const };
}
export async function POST(req: Request) {
  const f = z.object({ vehicle_count: z.number().int().min(0).max(500), avg_speed: z.number().min(0).max(120), hour: z.number().int().min(0).max(23) }).parse(await req.json());
  const base = process.env.ML_URL ?? "http://127.0.0.1:8001";
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    const r = await fetch(`${base}/predict`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f), signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (r.ok) return NextResponse.json({ ok: true, data: await r.json() });
  } catch { /* fallback */ }
  return NextResponse.json({ ok: true, data: { ...localPredict(f), fallback: "local-heuristic (FastAPI unreachable)" } });
}
