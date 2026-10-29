"use client";
import { useEffect, useState } from "react";
import { BrainCircuit, CheckCircle2, Route as RouteIcon, XCircle } from "lucide-react";
import { Badge, EmptyState, PageHeader, ProgressBar, Section, Stat } from "@/components/ui";

interface Cand { vehicleId: string; type?: string; eligible: boolean; exclusionReason?: string; explanation?: string; etaSec?: number; distanceKm?: number; traffic?: string; freshnessSec?: number }
interface RouteInfo { nodesExplored: number; heuristic: string; path: string[]; exploredOrder: string[]; costSec: number; distanceKm: number; altCosts: number[]; execMs?: number }
interface Rec { candidates: Cand[]; top3: Cand[]; routes: Record<string, RouteInfo>; closures?: string[] }
interface ML { modelVersion: string; synthetic: boolean; provenance: string; accuracy?: number; perClass?: Record<string, { precision: number; recall: number; f1: number }>; confusionMatrix?: { labels: string[]; matrix: number[][] }; featureImportance?: Record<string, number>; engine?: string }

export default function Explain() {
  const [rec, setRec] = useState<Rec | null>(null);
  const [ml, setMl] = useState<ML | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/dispatch/recommend").then((x) => x.json()).then((j) => { if (j.ok) { setRec(j.data); setSel(j.data.top3[0]?.vehicleId ?? null); } }).catch(() => {});
    fetch("/api/ml/model-info").then((x) => x.json()).then((j) => j.ok && setMl(j.data)).catch(() => {});
  }, []);
  const r = sel && rec?.routes ? rec.routes[sel] : null;
  const maxImp = Math.max(0.0001, ...Object.values(ml?.featureImportance ?? { x: 0 }));

  return (
    <main className="space-y-4">
      <PageHeader eyebrow="Viva panel" title="Explainable AI" sub="Why the system recommends what it recommends — every number inspectable, every decision overridable by a human." live
        actions={<Badge tone="neutral">SIMULATED DATA</Badge>} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={CheckCircle2} label="Eligible units" value={String(rec?.top3.length ?? "—")} sub="passed capability + route checks" tone="ok" />
        <Stat icon={XCircle} label="Excluded" value={String(rec ? rec.candidates.filter((c) => !c.eligible).length : "—")} sub="with stated reasons" tone="critical" />
        <Stat icon={BrainCircuit} label="Model" value={ml?.modelVersion ?? "—"} sub={ml ? `synthetic · ${ml.engine ?? "heuristic"}` : "loading…"} tone="info" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Section title="Recommendation ranking" sub="Ranked by A* travel-time on the live graph. Click a unit to inspect its route.">
            {!rec ? <EmptyState title="Loading recommendations…" /> : (
              <div className="space-y-2">
                {rec.top3.map((c, i) => (
                  <button key={c.vehicleId} onClick={() => setSel(c.vehicleId)}
                    className={`w-full rounded-xl border p-3 text-left transition ${sel === c.vehicleId ? "border-emerald-500/60 bg-emerald-500/[0.07]" : "border-white/10 bg-white/[0.02] hover:border-white/25"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-emerald-500/20 text-emerald-200" : "bg-white/10 text-slate-300"}`}>{i + 1}</span>
                      <span className="text-sm font-semibold">{c.vehicleId}</span>
                      <span className="text-xs text-slate-400">{c.type}</span>
                      <Badge tone={c.traffic === "high" ? "critical" : c.traffic === "medium" ? "urgent" : "ok"}>traffic {c.traffic ?? "—"}</Badge>
                      <span className="ml-auto font-mono text-sm text-slate-100">{c.etaSec != null ? `${Math.round(c.etaSec / 60)} min` : "—"}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{c.explanation}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-slate-500">
                      <span>dist {c.distanceKm ?? "—"} km</span><span>fresh {c.freshnessSec ?? "—"}s</span>
                    </div>
                  </button>
                ))}
                {rec.candidates.filter((c) => !c.eligible).map((c) => (
                  <div key={c.vehicleId} className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.04] p-3 text-xs">
                    <XCircle size={15} className="mt-0.5 shrink-0 text-red-400" />
                    <p className="text-slate-300"><span className="font-semibold">{c.vehicleId}</span> excluded — {c.exclusionReason}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-slate-600">Dispatcher override is always possible and logged; the model never dispatches alone.</p>
          </Section>
        </div>
        <div className="lg:col-span-2">
          <Section title="Route forensics" sub={sel ? `A* search trace for ${sel}` : "Select a unit."}>
            {r && sel ? (
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-1.5">
                  {[["Cost", `${r.costSec}s`], ["Distance", `${r.distanceKm} km`], ["Nodes explored", String(r.nodesExplored)], ["Compute", `${r.execMs ?? 0} ms`]].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-white/[0.03] p-2"><div className="text-slate-500">{k}</div><div className="font-mono font-medium text-slate-100">{v}</div></div>
                  ))}
                </div>
                <div className="rounded-lg bg-white/[0.03] p-2"><span className="text-slate-500">Alternatives (penalized re-runs): </span><span className="font-mono text-slate-200">[{r.altCosts.join(", ")}]s</span></div>
                <div className="rounded-lg bg-white/[0.03] p-2"><span className="text-slate-500">Heuristic: </span><span className="font-mono text-slate-200">{r.heuristic}</span><p className="mt-1 text-slate-500">Haversine ÷ 22.2 m/s — admissible, never overestimates at ≤80 km/h.</p></div>
                <div>
                  <div className="mb-1 text-slate-400">Expansion order <span className="text-slate-600">(green = final path)</span></div>
                  <div className="flex max-h-28 flex-wrap gap-1 overflow-auto">
                    {r.exploredOrder.map((n, i) => (
                      <span key={`${n}-${i}`} className={`rounded px-1.5 py-0.5 font-mono ${r.path.includes(n) ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-slate-500"}`}>{i + 1}.{n}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400"><RouteIcon size={13} /> Path: <span className="font-mono">{r.path.join(" → ")}</span></div>
              </div>
            ) : <EmptyState title="No route selected" />}
          </Section>
        </div>
      </div>

      <Section title="Random Forest model card" sub="Congestion classifier. Synthetic training data — accuracy is a demo property, never real-world performance." wide>
        {!ml ? <EmptyState title="Loading model card…" /> : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Version</span><span className="font-mono text-slate-200">{ml.modelVersion}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Data</span><Badge tone="urgent">synthetic</Badge></div>
              <div className="flex justify-between"><span className="text-slate-500">Engine</span><span className="font-mono text-slate-200">{ml.engine ?? "heuristic"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Held-out accuracy</span><span className="font-mono text-slate-200">{ml.accuracy != null ? ml.accuracy.toFixed(3) : "—"}</span></div>
              <p className="pt-1 text-[11px] leading-relaxed text-slate-500">{ml.provenance}</p>
            </div>
            <div>
              <div className="mb-1.5 text-xs text-slate-400">Per-class precision / recall / F1</div>
              <div className="space-y-1.5">
                {(ml.perClass ? Object.entries(ml.perClass) : []).map(([cls, m]) => (
                  <div key={cls} className="grid grid-cols-4 items-center gap-2 text-xs">
                    <span className="font-medium text-slate-200">{cls}</span>
                    {[["P", m.precision], ["R", m.recall], ["F1", m.f1]].map(([k, v]) => (
                      <span key={k as string} className="font-mono text-slate-400">{k} {(Number(v) * 100).toFixed(0)}%</span>
                    ))}
                  </div>
                ))}
              </div>
              {ml.confusionMatrix && (
                <div className="mt-3">
                  <div className="mb-1.5 text-xs text-slate-400">Confusion matrix (actual rows × predicted cols)</div>
                  <div className="inline-grid gap-1" style={{ gridTemplateColumns: `auto repeat(${ml.confusionMatrix.labels.length}, minmax(2rem, auto))` }}>
                    <span />
                    {ml.confusionMatrix.labels.map((l) => <span key={l} className="text-center text-[11px] text-slate-500">{l}</span>)}
                    {ml.confusionMatrix.matrix.map((row, i) => (
                      <>
                        <span key={`h-${i}`} className="pr-1 text-right text-[11px] text-slate-500">{ml.confusionMatrix!.labels[i]}</span>
                        {row.map((v, j) => <span key={`${i}-${j}`} className={`rounded px-1.5 py-1 text-center font-mono text-[11px] ${i === j ? "bg-emerald-500/15 text-emerald-200" : v > 0 ? "bg-red-500/15 text-red-200" : "bg-white/5 text-slate-500"}`}>{v}</span>)}
                      </>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <div className="mb-1.5 text-xs text-slate-400">Feature importance</div>
              <div className="space-y-2">
                {(ml.featureImportance ? Object.entries(ml.featureImportance).sort((a, b) => b[1] - a[1]) : []).map(([f, v]) => (
                  <div key={f}>
                    <div className="mb-0.5 flex justify-between text-xs"><span className="font-mono text-slate-300">{f}</span><span className="font-mono text-slate-500">{(v * 100).toFixed(1)}%</span></div>
                    <ProgressBar value={(v / maxImp) * 100} tone="bg-sky-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Section>
    </main>
  );
}
