"use client";
import { useEffect, useState } from "react";
import { Ambulance, CheckCircle2, ChevronRight, MapPin, Navigation, Phone, Radio } from "lucide-react";
import { Badge, EmptyState, PageHeader, ProgressBar, Section, Stat, Timeline, statusTone } from "@/components/ui";

const NEXT: Record<string, { to: string; label: string }> = {
  acknowledged: { to: "enroute", label: "Start driving to scene" },
  enroute: { to: "onscene", label: "Arrived at scene" },
  onscene: { to: "onboard", label: "Patient onboard" },
  onboard: { to: "athospital", label: "Arrived at hospital" },
  athospital: { to: "handover", label: "Begin handover" },
  handover: { to: "completed", label: "Complete handover" },
};
const ORDER = ["acknowledged", "enroute", "onscene", "onboard", "athospital", "handover", "completed"];

interface Detail { incident?: { code?: string; status: string; addressText?: string; priority?: string; category?: string; timeline: { at: string; by: string; event: string; detail: string }[] }; assignment?: { vehicleId: string; status: string; strategy?: string } | null }

export default function Driver() {
  const [code, setCode] = useState("INC-DEMO-001");
  const [d, setD] = useState<Detail | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const r = await fetch(`/api/incidents/${code}`).then((x) => x.json()).catch(() => null);
    if (r?.ok) setD(r.data);
  };
  useEffect(() => { refresh(); const es = new EventSource("/api/stream"); es.onmessage = refresh; return () => es.close(); }, [code]);
  async function call(url: string, body: unknown, actor = "driver") {
    setBusy(true);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-actor": actor }, body: JSON.stringify(body) });
      const j = await r.json(); setMsg(j.ok ? "Done." : `Error: ${j.error}`); refresh();
    } finally { setBusy(false); }
  }
  async function advance() {
    const st = d?.incident?.status ?? "";
    const nx = NEXT[st];
    if (!nx || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/incidents/${code}/status`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-actor": "driver" }, body: JSON.stringify({ to: nx.to }) });
      const j = await r.json(); setMsg(j.ok ? `Status → ${nx.to}` : `Error: ${j.error}`); refresh();
    } finally { setBusy(false); }
  }
  const st = d?.incident?.status ?? "?";
  const stepIdx = ORDER.indexOf(st);
  const progress = stepIdx >= 0 ? Math.round(((stepIdx + 1) / ORDER.length) * 100) : 0;
  const nx = NEXT[st];

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow="Ambulance crew" title={d?.assignment?.vehicleId ?? "Driver console"} sub="Accept the assignment, then advance one status at a time. Large controls, minimal distraction." live
        actions={<input className="input w-44" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Incident code" />} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Ambulance} label="Assignment" value={d?.assignment ? `${d.assignment.vehicleId} · ${d.assignment.status}` : "none yet"} sub={d?.assignment?.strategy ?? "propose from /dispatch"} tone={d?.assignment ? "ok" : "urgent"} />
        <Stat icon={MapPin} label="Incident status" value={st} sub={d?.incident?.addressText ?? "—"} tone={statusTone(st) === "critical" ? "critical" : statusTone(st) === "ok" ? "ok" : "info"} />
        <Stat icon={Navigation} label="Run progress" value={`${progress}%`} sub={stepIdx >= 0 ? `step ${stepIdx + 1} of ${ORDER.length}` : "awaiting assignment"} tone="info" />
      </div>

      <Section title="Run control" sub="Respond first, then advance through the run. Every tap is audited.">
        <ProgressBar value={progress} tone={st === "completed" ? "bg-ok" : "bg-sky-400"} />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {ORDER.map((s, i) => (
            <span key={s} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${i <= stepIdx ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5 text-slate-500"}`}>
              {i <= stepIdx ? <CheckCircle2 size={11} /> : <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />} {s}
            </span>
          ))}
        </div>
        {!d?.assignment ? (
          <EmptyState title="No assignment yet" body="A dispatcher must propose an ambulance from /dispatch first. This console updates live." />
        ) : d.assignment.status === "proposed" || d.assignment.status === "approved" ? (
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-primary py-4 text-base" disabled={busy} onClick={() => call(`/api/assignments/${code}/acknowledge`, { accept: true })}>Accept run</button>
            <button className="btn-ghost py-4 text-base" disabled={busy} onClick={() => call(`/api/assignments/${code}/acknowledge`, { accept: false, reason: "low fuel (logged)" })}>Reject</button>
          </div>
        ) : st === "completed" ? (
          <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 size={16} /> Run completed and handed over. Return to available from fleet.</p>
        ) : nx ? (
          <button className="btn-primary w-full py-4 text-base" disabled={busy} onClick={advance}>
            {nx.label} <ChevronRight size={18} /> <span className="text-xs opacity-70">({st} → {nx.to})</span>
          </button>
        ) : (
          <p className="text-sm text-slate-400">Waiting for dispatcher action (status: {st}).</p>
        )}
        {msg && <p className="text-xs text-slate-300">{msg}</p>}
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Incident card" sub="What you are driving to.">
          {d?.incident ? (
            <dl className="grid grid-cols-2 gap-2 text-xs">
              {[["Code", code], ["Category", d.incident.category ?? "—"], ["Priority", d.incident.priority ?? "—"], ["Pickup", d.incident.addressText ?? "—"]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-white/[0.03] p-2.5"><dt className="text-slate-500">{k}</dt><dd className="mt-0.5 font-medium text-slate-100">{v}</dd></div>
              ))}
            </dl>
          ) : <EmptyState title="Loading incident…" />}
        </Section>
        <Section title="Contact + comms" sub="Simulated contacts.">
          <div className="grid gap-2">
            <button className="btn-ghost justify-start" onClick={() => setMsg("Dispatcher contacted on simulated channel (logged).")}><Phone size={15} /> Contact dispatcher</button>
            <button className="btn-ghost justify-start" onClick={() => setMsg("Roadblock alert broadcast to corridor (simulated).")}><Radio size={15} /> Broadcast roadblock alert</button>
          </div>
        </Section>
      </div>

      <Section title="Run timeline" sub="Live status and assignment events.">
        <Timeline items={(d?.incident?.timeline ?? []).map((t) => ({ at: t.at, title: t.event, detail: `${t.by} — ${t.detail}` }))} empty="No events yet — propose an assignment from /dispatch." />
      </Section>
    </main>
  );
}
