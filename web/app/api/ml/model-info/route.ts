import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const base = process.env.ML_URL ?? "http://127.0.0.1:8001";
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    const r = await fetch(`${base}/model/info`, { signal: ctl.signal, cache: "no-store" });
    clearTimeout(t);
    if (r.ok) return NextResponse.json({ ok: true, data: await r.json() });
  } catch { /* fallback */ }
  return NextResponse.json({ ok: true, data: { modelVersion: "rf-v1-seed42", synthetic: true, provenance: "synthetic generator (seed 42), NOT real traffic. Demo only.", note: "FastAPI unreachable — serving embedded model card (synthetic). Train via ml-service/train.py." } });
}
