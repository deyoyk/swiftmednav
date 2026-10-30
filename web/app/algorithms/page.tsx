"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, GitCompareArrows, HeartPulse, Pause, Play, Route as RouteIcon, SkipBack, SkipForward, RotateCcw, TreeDeciduous } from "lucide-react";
import { astar, astarTrace, type AStarTrace } from "@/lib/graph";
import { etaAnatomy } from "@/lib/anatomy";
import { demoEdges, demoNodes } from "@/lib/demoGraph";
import type { GraphEdge } from "@/lib/graph";
import { Badge, EmptyState, Field, PageHeader, Section, Stat } from "@/components/ui";

const STARTS = [
  { id: "A-base", label: "AMB-A base (near, congested)" },
  { id: "B-base", label: "AMB-B base (far, free)" },
  { id: "N1", label: "AMB-C post (N1)" },
];
const GOAL = "INC";

function weightedEdges(mult: number, closed: boolean): GraphEdge[] {
  return demoEdges.map((e) => {
    let out = { ...e };
    if (e.segId === "seg-a3-congested") {
      out = { ...out, congestionMult: (out.congestionMult ?? 1) * mult };
      if (closed) out = { ...out, closed: true };
    }
    return out;
  });
}

function fmtETA(sec: number): string {
  if (!isFinite(sec)) return "—";
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/* ---------- SVG mini-map of the demo graph ---------- */
function GraphMap({ trace, upto, showPath, congestedSegs, closedSegs }: { trace: AStarTrace | null; upto: number; showPath: boolean; congestedSegs: Set<string>; closedSegs: Set<string> }) {
  const xs = [...demoNodes.values()].map((n) => n.lng);
  const ys = [...demoNodes.values()].map((n) => n.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 0.0015;
  const X = (lng: number) => 20 + ((lng - (minX - pad)) / (maxX - minX + pad * 2)) * 360;
  const Y = (lat: number) => 200 - ((lat - (minY - pad)) / (maxY - minY + pad * 2)) * 160;
  const seen = trace ? new Set(trace.steps.slice(0, upto).map((s) => s.current)) : new Set<string>();
  const openSet = trace && upto > 0 && upto <= trace.steps.length ? new Set(trace.steps[upto - 1]!.open) : new Set<string>();
  const cur = trace && upto > 0 && upto <= trace.steps.length ? trace.steps[upto - 1]!.current : null;
  const pathSet = trace && showPath ? new Set(trace.path) : new Set<string>();
  // dedupe undirected edges for drawing
  const drawn = new Map<string, GraphEdge>();
  for (const e of demoEdges) {
    const k = [e.from, e.to].sort().join(">");
    if (!drawn.has(k)) drawn.set(k, e);
  }
  return (
    <svg viewBox="0 0 400 220" className="w-full rounded-lg bg-ink-950">
      {[...drawn.values()].map((e) => {
        const a = demoNodes.get(e.from)!, b = demoNodes.get(e.to)!;
        const closed = closedSegs.has(e.segId);
        const cong = congestedSegs.has(e.segId);
        const onPath = pathSet.has(e.from) && pathSet.has(e.to);
        return (
          <line key={`${e.from}-${e.to}`} x1={X(a.lng)} y1={Y(a.lat)} x2={X(b.lng)} y2={Y(b.lat)}
            stroke={closed ? "#ef4444" : onPath ? "#22c55e" : cong ? "#f59e0b" : "#334155"}
            strokeWidth={onPath ? 3 : 1.5} strokeDasharray={closed ? "5 4" : e.oneWay ? "2 3" : undefined} opacity={closed ? 0.9 : 0.85} />
        );
      })}
      {[...demoNodes.values()].map((n) => {
        const isCur = cur === n.id;
        const isSeen = seen.has(n.id);
        const isOpen = openSet.has(n.id);
        const fill = isCur ? "#ef4444" : pathSet.has(n.id) && showPath ? "#22c55e" : isSeen ? "#64748b" : isOpen ? "#f59e0b" : "#1e293b";
        return (
          <g key={n.id}>
            <circle cx={X(n.lng)} cy={Y(n.lat)} r={isCur ? 9 : 7} fill={fill} stroke="#e2e8f0" strokeWidth={1.5} />
            <text x={X(n.lng)} y={Y(n.lat) - 12} textAnchor="middle" fontSize="9" fill="#cbd5e1" fontFamily="monospace">{n.id}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ================= MAIN PAGE ================= */
type Tab = "astar" | "race" | "eta" | "rf" | "hospital";

export default function AlgorithmsPage() {
  const [tab, setTab] = useState<Tab>("astar");
  return (
    <main className="space-y-4">
      <PageHeader eyebrow="Viva bench" title="Algorithm lab" sub="Every number below is computed live by the real algorithms on the real demo graph — step through them, change the inputs, watch the search think." live
        actions={<Badge tone="neutral">deterministic · seed-free</Badge>} />
      <div className="flex flex-wrap gap-2">
        {([["astar", "A* explorer", RouteIcon], ["race", "A* vs Dijkstra", GitCompareArrows], ["eta", "ETA anatomy", HeartPulse], ["rf", "RF tree inspector", TreeDeciduous], ["hospital", "Hospital match", FlaskConical]] as [Tab, string, typeof RouteIcon][]).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)} className={`btn ${tab === t ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100" : "btn-ghost"} px-3 py-2 text-xs`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {tab === "astar" && <AStarExplorer />}
      {tab === "race" && <RaceTab />}
      {tab === "eta" && <EtaTab />}
      {tab === "rf" && <RfTab />}
      {tab === "hospital" && <HospitalTab />}
    </main>
  );
}

/* ---------- TAB 1: A* step-through ---------- */
function AStarExplorer() {
  const [start, setStart] = useState("A-base");
  const [mult, setMult] = useState(3);
  const [closed, setClosed] = useState(false);
  const [idx, setIdx] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [showPath, setShowPath] = useState(true);

  const trace = useMemo(() => {
    try {
      return astarTrace(demoNodes, weightedEdges(mult, closed), start, GOAL);
    } catch {
      return null;
    }
  }, [start, mult, closed]);
  const max = trace?.steps.length ?? 0;
  useEffect(() => { setIdx(1); setPlaying(false); }, [start, mult, closed]);
  useEffect(() => {
    if (!playing || !trace) return;
    if (idx >= max) { setPlaying(false); return; }
    const id = setTimeout(() => setIdx((i) => Math.min(i + 1, max)), 650);
    return () => clearTimeout(id);
  }, [playing, idx, max, trace]);

  const cur = trace && idx > 0 ? trace.steps[Math.min(idx, max) - 1] : null;
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Section title="Search playground" sub="Same A* (admissible haversine heuristic) the dispatcher runs. Press play and watch the frontier move.">
          <GraphMap trace={trace} upto={idx} showPath={showPath}
            congestedSegs={new Set(mult > 1.2 ? ["seg-a3-congested"] : [])}
            closedSegs={new Set(closed ? ["seg-a3-congested"] : [])} />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-ghost px-3 py-2 text-xs" onClick={() => setIdx(1)} aria-label="Restart"><SkipBack size={14} /></button>
            <button className="btn-ghost px-3 py-2 text-xs" onClick={() => setIdx((i) => Math.max(1, i - 1))} aria-label="Step back"><SkipBack size={14} /> Back</button>
            <button className="btn-primary px-4 py-2 text-xs" onClick={() => setPlaying((p) => !p)}>{playing ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}</button>
            <button className="btn-ghost px-3 py-2 text-xs" onClick={() => setIdx((i) => Math.min(max, i + 1))} aria-label="Step forward">Step <SkipForward size={14} /></button>
            <span className="ml-auto font-mono text-xs text-slate-400">step {Math.min(idx, max)} / {max}</span>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={showPath} onChange={(e) => setShowPath(e.target.checked)} /> show final path</label>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Start (ambulance)"><select className="input mt-1" value={start} onChange={(e) => setStart(e.target.value)}>{STARTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
            <Field label={`Corridor congestion ×${mult}`}><input type="range" min={1} max={4} step={0.5} value={mult} onChange={(e) => setMult(Number(e.target.value))} className="mt-3 w-full accent-amber-400" /></Field>
            <label className="flex items-end gap-2 pb-1 text-xs text-slate-300"><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> close N2→INC segment</label>
          </div>
        </Section>
      </div>
      <div className="lg:col-span-2">
        <Section title="Expansion inspector" sub="Snapshot of the priority queue at the current step.">
          {!trace || !cur ? <p className="text-xs text-slate-500">No trace — check the graph is connected with these settings.</p> : (
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-4 gap-1.5">
                {[["node", cur.current], ["g", `${cur.g}s`], ["h", `${cur.h}s`], ["f", `${cur.f}s`]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/[0.04] p-2 text-center"><div className="text-slate-500">{k}</div><div className="font-mono font-medium text-slate-100">{v}</div></div>
                ))}
              </div>
              <div>
                <div className="mb-1 text-slate-400">OPEN — frontier ({cur.open.length}) <span className="text-slate-600">heap order, popped smallest f first</span></div>
                <div className="flex max-h-20 flex-wrap gap-1 overflow-auto">{cur.open.length ? cur.open.map((n) => <span key={n} className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-amber-200">{n}</span>) : <span className="text-slate-600">empty</span>}</div>
              </div>
              <div>
                <div className="mb-1 text-slate-400">CLOSED — expanded ({cur.closed.length})</div>
                <div className="flex max-h-20 flex-wrap gap-1 overflow-auto">{cur.closed.map((n, i) => <span key={n} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-slate-400" title={`expansion #${i + 1}`}>{i + 1}.{n}</span>)}</div>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">Heuristic: {trace.heuristic}. It never overestimates true remaining time at ≤80 km/h, so the first time the goal is popped, its g is optimal. Path: <span className="font-mono text-slate-300">{trace.path.join(" → ") || "—"}</span> costing {trace.costSec}s over {trace.nodesExplored} expansions.</p>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

/* ---------- TAB 2: A* vs Dijkstra ---------- */
function RaceTab() {
  const [mult, setMult] = useState(3);
  const [closed, setClosed] = useState(false);
  const edges = useMemo(() => weightedEdges(mult, closed), [mult, closed]);
  const starts = ["A-base", "B-base", "N1"];
  const rows = starts.map((s) => {
    const a = astar(demoNodes, edges, s, GOAL);
    const d = astar(demoNodes, edges, s, GOAL, { useZeroHeuristic: true });
    return { start: s, aNodes: a.nodesExplored, dNodes: d.nodesExplored, cost: a.costSec, samePath: JSON.stringify(a.path) === JSON.stringify(d.path), valid: a.valid && d.valid };
  });
  const maxNodes = Math.max(1, ...rows.map((r) => Math.max(r.aNodes, r.dNodes)));
  return (
    <Section title="Fair race: same graph, same costs" sub="Dijkstra is A* with a zero heuristic. Same optimum guaranteed — the difference is how much of the graph each explores." wide>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={`Corridor congestion ×${mult}`}><input type="range" min={1} max={4} step={0.5} value={mult} onChange={(e) => setMult(Number(e.target.value))} className="w-full accent-amber-400" /></Field>
        <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> close N2→INC segment</label>
      </div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.start} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold">{r.start} → {GOAL}</span>
              <Badge tone={r.valid ? (r.samePath ? "ok" : "info") : "critical"}>{r.valid ? (r.samePath ? "identical optimal path" : "same cost, alt tie-break") : "disconnected"}</Badge>
              <span className="ml-auto font-mono text-xs text-slate-400">optimal {r.cost}s</span>
            </div>
            {(["A*", "Dijkstra"] as const).map((name) => {
              const v = name === "A*" ? r.aNodes : r.dNodes;
              return (
                <div key={name} className="mt-2 grid grid-cols-[86px_1fr_64px] items-center gap-2 text-xs">
                  <span className={name === "A*" ? "text-emerald-300" : "text-sky-300"}>{name}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${name === "A*" ? "bg-emerald-400" : "bg-sky-400"}`} style={{ width: `${Math.max(4, (v / maxNodes) * 100)}%` }} /></div>
                  <span className="text-right font-mono text-slate-300">{v} nodes</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">No claim that A* is “better than Google Maps” — this compares two textbook algorithms on our own graph, where the honest story is: admissibility buys fewer expansions for the same optimum.</p>
    </Section>
  );
}

/* ---------- TAB 3: ETA anatomy ---------- */
function EtaTab() {
  const [amb, setAmb] = useState("B-base");
  const [mult, setMult] = useState(3);
  const [closed, setClosed] = useState(true);
  const [cands, setCands] = useState<{ vehicleId: string; nodeId: string }[]>([
    { vehicleId: "AMB-A", nodeId: "A-base" }, { vehicleId: "AMB-B", nodeId: "B-base" }, { vehicleId: "AMB-C", nodeId: "N1" },
  ]);
  useEffect(() => {
    fetch("/api/dispatch/recommend").then((x) => x.json()).then((j) => {
      if (j?.ok && Array.isArray(j.data?.top3)) {
        const map: Record<string, string> = { "AMB-A": "A-base", "AMB-B": "B-base", "AMB-C": "N1" };
        setCands(j.data.top3.map((c: { vehicleId: string }) => ({ vehicleId: c.vehicleId, nodeId: map[c.vehicleId] ?? "A-base" })));
      }
    }).catch(() => {});
  }, []);
  const edges = useMemo(() => weightedEdges(mult, closed), [mult, closed]);
  const node = cands.find((c) => c.vehicleId === amb)?.nodeId ?? "A-base";
  let anatomy = null as ReturnType<typeof etaAnatomy> | null;
  try { anatomy = etaAnatomy(demoNodes, edges, node, GOAL); } catch { anatomy = null; }
  const maxT = Math.max(1, anatomy?.open.total ?? 0, anatomy?.closed.total ?? 0);
  const bar = (label: string, parts: [string, number, string][], total: number) => (
    <div>
      <div className="mb-1 flex justify-between text-xs"><span className="text-slate-300">{label}</span><span className="font-mono text-slate-100">{fmtETA(total)} ({total}s)</span></div>
      <div className="flex h-6 w-full overflow-hidden rounded-lg bg-white/10">
        {parts.map(([k, v, cls]) => v > 0 && <div key={k} className={cls} style={{ width: `${(v / maxT) * 100}%` }} title={`${k}: ${v}s`} />)}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-500">{parts.map(([k, v]) => <span key={k}>{k} {v}s</span>)}</div>
    </div>
  );
  return (
    <Section title="ETA anatomy" sub="One live recommendation, decomposed. Every second is accounted for by the road graph — base travel, congestion delay, closure detour." wide
      actions={<Badge tone={closed ? "urgent" : "ok"}>{closed ? "closure applied" : "all roads open"}</Badge>}>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Ambulance"><select className="input mt-1" value={amb} onChange={(e) => setAmb(e.target.value)}>{cands.map((c) => <option key={c.vehicleId} value={c.vehicleId}>{c.vehicleId}</option>)}</select></Field>
        <Field label={`Corridor congestion ×${mult}`}><input type="range" min={1} max={4} step={0.5} value={mult} onChange={(e) => setMult(Number(e.target.value))} className="mt-3 w-full accent-amber-400" /></Field>
        <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> close N2→INC segment</label>
      </div>
      {!anatomy || !anatomy.closed.valid ? <p className="text-xs text-slate-500">No valid route with these settings — reopen the segment.</p> : (
        <div className="space-y-4">
          {bar("Without closure (hypothetical reference)", [["base", anatomy.open.base, "bg-sky-400"], ["congestion", anatomy.open.congestion, "bg-amber-400"]], anatomy.open.total)}
          {bar("With closure (what dispatch actually uses)", [["base", anatomy.closed.base, "bg-sky-400"], ["congestion", anatomy.closed.congestion, "bg-amber-400"], ["closure detour", anatomy.closurePenalty, "bg-red-400"]], anatomy.closed.total)}
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
            <span><span className="mr-1 inline-block h-2 w-2 rounded bg-sky-400" />free-flow base</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded bg-amber-400" />traffic delay</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded bg-red-400" />closure detour</span>
          </div>
          <p className="text-[11px] text-slate-500">Path taken: <span className="font-mono text-slate-300">{anatomy.closed.path.join(" → ")}</span>. Base + congestion always sum to the A* total on the chosen path — closure penalty is measured against the best open-road alternative, never invented.</p>
        </div>
      )}
    </Section>
  );
}

/* ---------- TAB 4: RF tree inspector ---------- */
interface TreeNode { node: number; depth: number; feature: string; threshold: number; value: number; op: string; branch: string }
interface TreePath { tree: number; nodes: TreeNode[]; truncated?: boolean; leafVotes: number[]; leafClass: string }
interface TreeResp { class: string; probabilities: Record<string, number>; engine?: string; nTreesTotal?: number; paths?: TreePath[] }

function RfTab() {
  const [vc, setVc] = useState(150);
  const [sp, setSp] = useState(10);
  const [hr, setHr] = useState(9);
  const [r, setR] = useState<TreeResp | null>(null);
  const [msg, setMsg] = useState("Move a slider to trace a live prediction through real trees.");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setBusy(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch("/api/ml/tree-path", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicle_count: vc, avg_speed: sp, hour: hr, n_trees: 3 }) });
        const j = await res.json();
        if (!live) return;
        if (j.ok) { setR(j.data); setMsg(""); }
        else setMsg(`${j.error ?? "prediction failed"} — start the ML service (uvicorn app:app --port 8001) with a trained rf_model.pkl.`);
      } catch { if (live) setMsg("ML service unreachable — start it with: uvicorn app:app --port 8001."); }
      finally { if (live) setBusy(false); }
    }, 350);
    return () => { live = false; clearTimeout(id); };
  }, [vc, sp, hr]);
  const conf = r ? Math.max(...Object.values(r.probabilities)) : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <Section title="Live input" sub="Same three features the report was trained on. Synthetic data — this traces logic, not the real world.">
          <Field label={`vehicles on segment: ${vc}`}><input type="range" min={0} max={300} value={vc} onChange={(e) => setVc(Number(e.target.value))} className="w-full accent-sky-400" /></Field>
          <Field label={`avg speed: ${sp} km/h`}><input type="range" min={3} max={80} value={sp} onChange={(e) => setSp(Number(e.target.value))} className="w-full accent-sky-400" /></Field>
          <Field label={`hour of day: ${hr}:00`}><input type="range" min={0} max={23} value={hr} onChange={(e) => setHr(Number(e.target.value))} className="w-full accent-sky-400" /></Field>
          {r && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between"><span className="text-xs text-slate-400">Forest vote</span><Badge tone={r.class === "high" ? "critical" : r.class === "medium" ? "urgent" : "ok"}>{r.class}</Badge></div>
              <div className="mt-1 text-2xl font-semibold">{Math.round(conf * 100)}% <span className="text-sm font-normal text-slate-400">confidence</span></div>
              <div className="mt-2 space-y-1">{Object.entries(r.probabilities).map(([k, v]) => (
                <div key={k} className="grid grid-cols-[64px_1fr_44px] items-center gap-2 text-xs"><span className="text-slate-400">{k}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-sky-400" style={{ width: `${v * 100}%` }} /></div>
                  <span className="text-right font-mono">{Math.round(v * 100)}%</span></div>
              ))}</div>
              <p className="mt-2 text-[11px] text-slate-500">{r.nTreesTotal} trees voted · engine {r.engine ?? "?"}</p>
            </div>
          )}
          {busy && !r && <p className="text-xs text-slate-500">Tracing…</p>}
          {msg && <p className="text-xs text-amber-300">{msg}</p>}
        </Section>
      </div>
      <div className="lg:col-span-3">
        <Section title="Decision paths" sub="How the first trees actually voted — feature, threshold and branch at every node, plus leaf vote tallies." wide>
          {!r?.paths?.length ? <EmptyState title="No trace yet" body="Move a slider — or start the ML service if it reports unreachable." /> : (
            <div className="space-y-3">
              {r.paths.map((t) => (
                <div key={t.tree} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs"><span className="font-mono font-semibold text-slate-200">tree #{t.tree}</span><Badge tone={t.leafClass === "high" ? "critical" : t.leafClass === "medium" ? "urgent" : "ok"}>leaf: {t.leafClass}</Badge>{t.truncated && <span className="text-slate-500">(truncated at depth 25)</span>}</div>
                  <div className="space-y-1">
                    {t.nodes.map((n, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded bg-white/[0.03] px-2 py-1 font-mono text-[11px]">
                        <span className="text-slate-500">d{n.depth}</span>
                        <span className="text-sky-300">{n.feature}</span>
                        <span className="text-slate-300">{n.value} {n.op} {n.threshold}</span>
                        <span className={n.branch === "left" ? "text-emerald-300" : "text-amber-300"}>→ {n.branch}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-500">leaf votes [{t.leafVotes.map((v) => Math.round(v)).join(", ")}] over [low, medium, high]</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

/* ---------- TAB 5: hospital match ---------- */
interface MatchStep { check: string; pass: boolean; detail: string }
interface MatchResp { hospital: string; eligible: boolean; steps: MatchStep[]; etaSec: number | null; distanceKm: number | null; humanDecision: string | null; note: string }

function HospitalTab() {
  const [m, setM] = useState<MatchResp | null>(null);
  const [msg, setMsg] = useState("Loading…");
  useEffect(() => {
    const load = async () => {
      const r = await fetch("/api/incidents/INC-DEMO-001").then((x) => x.json()).catch(() => null);
      if (r?.ok && r.data?.hospitalMatch) { setM(r.data.hospitalMatch); setMsg(""); }
      else setMsg("Could not load the match trace.");
    };
    load();
    const es = new EventSource("/api/stream");
    es.onmessage = load;
    return () => es.close();
  }, []);
  return (
    <Section title="Hospital matching trace — INC-DEMO-001" sub="Eligibility is a hard clinical filter. Capacity informs, never overrides. A human accepts." wide
      actions={m && <Badge tone={m.eligible ? "ok" : "critical"}>{m.eligible ? "eligible" : "not eligible"}</Badge>}>
      {!m ? <p className="text-xs text-slate-400">{msg}</p> : (
        <div className="space-y-2">
          {m.steps.map((s) => (
            <div key={s.check} className={`flex items-start gap-2 rounded-xl border p-3 ${s.pass ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-red-500/30 bg-red-500/[0.05]"}`}>
              <span className={`mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${s.pass ? "bg-emerald-400" : "bg-red-400"}`} />
              <div><div className="text-sm font-medium text-slate-100">{s.check}</div><div className="mt-0.5 text-xs text-slate-400">{s.detail}</div></div>
            </div>
          ))}
          <p className="text-[11px] text-slate-500">Corridor ETA {m.etaSec != null ? fmtETA(m.etaSec) : "—"}{m.distanceKm != null ? ` · ${m.distanceKm} km` : ""}. {m.note}</p>
        </div>
      )}
    </Section>
  );
}
