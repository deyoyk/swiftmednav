"use client";
interface Cand { vehicleId: string; type: string; eligible: boolean; exclusionReason?: string; distanceKm?: number; etaSec?: number; traffic?: string; freshnessSec?: number; explanation?: string }
interface Props {
  candidates: Cand[]; top3: Cand[];
  routes: Record<string, { path: string[]; costSec: number; distanceKm: number; nodesExplored: number; execMs: number; altCosts: number[]; exploredOrder: string[]; heuristic: string }>;
  selected: string | null;
  onSelect(v: string): void;
  onApprove(v: string): void;
  approving: boolean;
}
export default function ExplainPanel({ candidates, top3, routes, selected, onSelect, onApprove, approving }: Props) {
  const sel = selected ?? top3[0]?.vehicleId ?? null;
  const r = sel ? routes[sel] : null;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {top3.map((c, i) => (
          <button key={c.vehicleId} onClick={() => onSelect(c.vehicleId)}
            className={`rounded-lg border p-3 text-left ${sel === c.vehicleId ? "border-emerald-500/60 bg-emerald-500/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"}`}>
            <div className="text-sm font-medium">#{i + 1} {c.vehicleId} <span className="text-slate-400">{c.type}</span></div>
            <div className="text-xs text-slate-400">ETA {c.etaSec != null ? Math.round(c.etaSec / 60) : "—"} min · {c.distanceKm} km · traffic {c.traffic} · fresh {c.freshnessSec}s</div>
            <p className="mt-1 text-xs text-slate-300">{c.explanation}</p>
          </button>
        ))}
      </div>
      {candidates.filter((c) => !c.eligible).map((c) => (
        <p key={c.vehicleId} className="text-xs text-slate-400">✕ {c.vehicleId} excluded — {c.exclusionReason}</p>
      ))}
      {r && sel && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs">
          <div className="font-medium text-slate-200">Route analysis — {sel} <span className="badge border-white/10 bg-white/5">SIMULATED</span></div>
          <div className="mt-1 grid grid-cols-2 gap-1 text-slate-300 sm:grid-cols-4">
            <span>cost {r.costSec}s</span><span>dist {r.distanceKm} km</span>
            <span>nodes {r.nodesExplored}</span><span>exec {r.execMs} ms</span>
          </div>
          <div className="mt-1 text-slate-400">heuristic {r.heuristic} · alt costs [{r.altCosts.join(", ")}]s · path {r.path.join(" → ")}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {r.exploredOrder.map((n, i) => (
              <span key={`${n}-${i}`} title={`visit #${i + 1}`} className={`rounded px-1.5 py-0.5 ${r.path.includes(n) ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-slate-400"}`}>{i + 1}.{n}</span>
            ))}
          </div>
          <p className="mt-1 text-slate-500">Green = final path; order = A* expansion sequence (viva viz).</p>
          <button disabled={approving} onClick={() => sel && onApprove(sel)} className="btn-primary mt-2 w-full">{approving ? "Approving…" : `Approve ${sel} (human sign-off)`}</button>
        </div>
      )}
    </div>
  );
}
