"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Ambulance, CheckCircle2, ClipboardList, RotateCcw, TrafficCone } from "lucide-react";
import ExplainPanel from "@/components/ExplainPanel";
import { Badge, EmptyState, PageHeader, Section, Timeline } from "@/components/ui";
const DispatchMap = dynamic(() => import("@/components/DispatchMap"), { ssr: false });

const NODES = [
  { id: "A-base", lng: 80.209, lat: 13.087 }, { id: "N1", lng: 80.212, lat: 13.089 },
  { id: "N2", lng: 80.216, lat: 13.09 }, { id: "N3", lng: 80.22, lat: 13.091 },
  { id: "B-base", lng: 80.228, lat: 13.095 }, { id: "N4", lng: 80.218, lat: 13.085 },
  { id: "INC", lng: 80.221, lat: 13.088 }, { id: "HOSP", lng: 80.225, lat: 13.082 },
];
const AMB_POS: Record<string, { lng: number; lat: number; label: string }> = {
  "AMB-A": { lng: 80.209, lat: 13.087, label: "BLS · ventilator ✓" },
  "AMB-B": { lng: 80.228, lat: 13.095, label: "ALS · ventilator ✓" },
  "AMB-C": { lng: 80.212, lat: 13.089, label: "BLS · no ventilator" },
};

interface Rec { candidates: never[]; top3: never[]; routes: Record<string, { path: string[]; coords: [number, number][]; costSec: number; distanceKm: number; nodesExplored: number; execMs: number; valid: boolean; altCosts: number[]; exploredOrder: string[]; heuristic: string }>; closures: string[] }

export default function Dispatch() {
  const [code, setCode] = useState("INC-DEMO-001");
  const [incidents, setIncidents] = useState<{ code: string; status: string; priority: string }[]>([{ code: "INC-DEMO-001", status: "pending", priority: "critical" }]);
  const [detail, setDetail] = useState<{ incident?: { status: string; timeline: { at: string; by: string; event: string; detail: string }[] }; assignment?: { vehicleId: string; status: string; strategy: string; overrideReason?: string } } | null>(null);
  const [rec, setRec] = useState<Rec | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>(["INC-DEMO-001 loaded (SIMULATED)."]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [showAstar, setShowAstar] = useState(true);
  const [road, setRoad] = useState<{ distanceM: number; timeS: number } | null>(null);

  const refresh = useCallback(async () => {
    const [il, d, r] = await Promise.all([
      fetch("/api/incidents").then((x) => x.json()).catch(() => null),
      fetch(`/api/incidents/${code}`).then((x) => x.json()).catch(() => null),
      fetch("/api/dispatch/recommend").then((x) => x.json()).catch(() => null),
    ]);
    if (il?.ok) setIncidents(il.data.incidents.map((i: { code: string; status: string; priority: string }) => ({ code: i.code, status: i.status, priority: i.priority })));
    if (d?.ok) setDetail(d.data);
    if (r?.ok) { setRec(r.data); if (!selected && r.data.top3[0]) setSelected(r.data.top3[0].vehicleId); }
  }, [code]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (m) => { try { const j = JSON.parse(m.data); if (j.kind && j.kind !== "heartbeat" && j.kind !== "hello") setLog((l) => [...l.slice(-29), `${j.action ?? j.kind}: ${j.detail ?? ""}`]); } catch { /* heartbeat */ } refresh(); };
    return () => es.close();
  }, [refresh]);

  async function call(url: string, method: string, body?: unknown, actor = "dispatcher") {
    setBusy(true);
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json", "x-actor": actor }, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json();
      setLog((l) => [...l.slice(-29), `${method} ${url} → ${j.ok ? "ok" : `ERR ${j.error}`}`]);
      await refresh();
      return j;
    } finally { setBusy(false); }
  }
  const status = detail?.incident?.status ?? "?";
  const route = selected && rec?.routes ? rec.routes[selected] : null;
  const ambHere = selected ? AMB_POS[selected] : null;
  const roadWaypoints: [number, number][] | undefined = ambHere
    ? [[ambHere.lng, ambHere.lat], [80.221, 13.088], [80.225, 13.082]]
    : undefined;

  return (
    <main className="space-y-4">
      <PageHeader eyebrow="Emergency operations" title="Dispatch command" sub="Triage the queue, compare ambulances on live road routes, approve with a human sign-off. Every decision is audited." live
        actions={<>
          <input className="input w-40" placeholder="search code / category…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search incidents" />
          <select className="input w-56" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Incident">
            {incidents.filter((i) => `${i.code} ${i.status} ${i.priority}`.toLowerCase().includes(q.toLowerCase())).map((i) => <option key={i.code} value={i.code}>{i.code} · {i.status} · {i.priority}</option>)}
          </select>
          <Badge tone={status === "completed" ? "ok" : status === "pending" ? "urgent" : "info"}>status: {status}</Badge>
          {detail?.assignment && <Badge tone="ok">{detail.assignment.vehicleId} · {detail.assignment.status}</Badge>}
        </>} />

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card space-y-3 p-4 lg:col-span-3">
          <DispatchMap nodes={NODES} routeCoords={route?.coords ?? []} exploredOrder={route?.exploredOrder ?? []}
            incident={{ lng: 80.221, lat: 13.088 }}
            ambulances={Object.entries(AMB_POS).map(([vehicleId, p]) => ({ vehicleId, ...p }))}
            roadWaypoints={roadWaypoints} showAstar={showAstar} selectedId={selected} onRoadSummary={setRoad} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="inline-block h-[5px] w-6 rounded-full bg-red-500" /> road route</span>
            {showAstar && <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-6 border-t-2 border-dashed border-emerald-400" /> A* corridor</span>}
            <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink-800 text-[9px] font-bold text-white ring-1 ring-white">A</span> ambulance unit</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" /> incident</span>
            <span className="flex items-center gap-1.5"><span className="inline-flex h-4 w-4 items-center justify-center rounded bg-white text-[10px] font-extrabold text-red-600">H</span> hospital</span>
            <label className="flex items-center gap-1 text-slate-400"><input type="checkbox" checked={showAstar} onChange={(e) => setShowAstar(e.target.checked)} /> A* overlay</label>
            {road && route && <span className="text-slate-300">road {Math.round(road.timeS / 60)} min / {(road.distanceM / 1000).toFixed(1)} km · A* est {Math.round(route.costSec / 60)} min / {route.distanceKm} km</span>}
          </div>
          {rec ? (
            <ExplainPanel candidates={rec.candidates as never[]} top3={rec.top3 as never[]} routes={rec.routes}
              selected={selected} onSelect={setSelected}
              approving={busy}
              onApprove={async (v) => {
                const d = detail?.assignment;
                if (!d) { await call("/api/assignments", "POST", { incidentCode: code, vehicleId: v, strategy: "capability-filtered-traffic-aware" }); }
                await call(`/api/assignments/${code}/approve`, "POST", { vehicleId: v });
              }} />
          ) : <p className="text-sm text-slate-400">Loading recommendations…</p>}
        </section>

        <aside className="space-y-4 lg:col-span-2">
          <Section title="Runbook" sub="Guided order: propose → approve → crew runs it → hospital → complete.">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button disabled={busy} className="btn-ghost justify-start" onClick={() => call("/api/assignments", "POST", { incidentCode: code, strategy: "capability-filtered-traffic-aware" })}><Ambulance size={14} /> 1 · Propose</button>
              <button disabled={busy} className="btn-ghost justify-start" onClick={() => call(`/api/assignments/${code}/approve`, "POST", {})}><CheckCircle2 size={14} /> 2 · Approve top</button>
              <button disabled={busy} className="btn-ghost justify-start" onClick={() => call(`/api/incidents/${code}/status`, "PATCH", { to: "enroute" })}>Driver enroute</button>
              <button disabled={busy} className="btn-ghost justify-start" onClick={() => call(`/api/incidents/${code}/status`, "PATCH", { to: "onscene" })}>On scene</button>
              <button disabled={busy} className="btn-ghost justify-start" onClick={() => call(`/api/incidents/${code}/status`, "PATCH", { to: "onboard" })}>Onboard</button>
              <button disabled={busy} className="btn-ghost justify-start" onClick={() => call(`/api/incidents/${code}/status`, "PATCH", { to: "athospital" })}>At hospital</button>
              <button disabled={busy} className="btn-ghost justify-start" onClick={() => call("/api/handover/ack?kind=bed", "POST", { incidentCode: code, decision: "accept" }, "hospital_coordinator")}>Hospital accept</button>
              <button disabled={busy} className="btn-ghost justify-start" onClick={() => call(`/api/incidents/${code}/status`, "PATCH", { to: "handover" })}>Handover</button>
              <button disabled={busy} className="btn-primary col-span-2" onClick={() => call(`/api/incidents/${code}/status`, "PATCH", { to: "completed" })}>Complete incident</button>
            </div>
            <p className="text-[11px] text-slate-600">Steps 3–8 normally happen on driver / EMT / hospital consoles — the buttons here keep the demo runnable from one screen.</p>
          </Section>

          <Section title="Road closure + congestion" sub="SIMULATED network edits. A* recomputes instantly.">
            <div className="flex gap-2">
              <button disabled={busy} className="btn-ghost flex-1" onClick={() => call("/api/routes", "POST", { incidentCode: code, closures: ["seg-a3-congested"] })}><TrafficCone size={14} /> Inject N2→INC closure</button>
              <button disabled={busy} className="btn-ghost flex-1" onClick={() => call("/api/routes", "POST", { incidentCode: code, closures: [] })}><RotateCcw size={14} /> Clear</button>
            </div>
            {rec && <p className="text-xs text-slate-400">closures: {rec.closures.join(", ") || "none"} · corridor mult 3x (high)</p>}
          </Section>

          <Section title="Audit timeline" sub="Live. Duplicates, overrides and rejects are all recorded.">
            {(detail?.incident?.timeline.length ?? 0) + log.length === 0 ? <EmptyState title="No events yet" /> : (
              <div className="max-h-64 overflow-auto pr-1">
                <Timeline items={[
                  ...(detail?.incident?.timeline ?? []).map((t) => ({ at: t.at, title: t.event, detail: `${t.by} — ${t.detail}` })),
                  ...log.slice(-8).map((l) => ({ title: "console", detail: l })),
                ]} />
              </div>
            )}
            <p className="flex items-center gap-1.5 text-[11px] text-slate-600"><ClipboardList size={12} /> Atomic assignment guard blocks double-dispatch (409).</p>
          </Section>
        </aside>
      </div>
    </main>
  );
}
