"use client";
import { useEffect, useState } from "react";
import { BedDouble, Building2, CheckCircle2, HeartPulse, RefreshCw, Siren } from "lucide-react";
import { Badge, PageHeader, ProgressBar, Section, Stat, Timeline } from "@/components/ui";

interface Hosp { name: string; edAvail: number; edTotal: number; icuAvail: number; icuTotal: number; status: string; updatedAt: string }
interface Detail { incident?: { status: string; category?: string; priority?: string; addressText?: string; requiredCapabilities?: string[]; timeline: { at: string; by: string; event: string; detail: string }[] }; handover?: { vitals: Record<string, string>; notes: { at: string; by: string; text: string }[]; status: string; summary: string } | null }

export default function Hospital() {
  const [code] = useState("INC-DEMO-001");
  const [h, setH] = useState<Hosp | null>(null);
  const [d, setD] = useState<Detail | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const hr = await fetch("/api/analytics/hospital").then((x) => x.json()).catch(() => null);
    if (hr?.ok) setH(hr.data);
    const dr = await fetch(`/api/incidents/${code}`).then((x) => x.json()).catch(() => null);
    if (dr?.ok) setD(dr.data);
  };
  useEffect(() => { refresh(); const es = new EventSource("/api/stream"); es.onmessage = refresh; return () => es.close(); }, [code]);
  async function act(url: string, body: unknown) {
    setBusy(true);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-actor": "hospital_coordinator" }, body: JSON.stringify(body) });
      const j = await r.json(); setMsg(j.ok ? "Recorded and audited." : `Error: ${j.error}`); refresh();
    } finally { setBusy(false); }
  }
  const edPct = h ? Math.round((h.edAvail / Math.max(1, h.edTotal)) * 100) : 0;
  const icuPct = h ? Math.round((h.icuAvail / Math.max(1, h.icuTotal)) * 100) : 0;
  const freshMin = h ? Math.max(0, Math.round((Date.now() - Date.parse(h.updatedAt)) / 60000)) : null;

  return (
    <main className="mx-auto max-w-4xl space-y-4">
      <PageHeader eyebrow="Hospital emergency department" title={h?.name ?? "Receiving hospital"} sub="Bed coordinator view. Acceptance is a human clinical decision — capacity and capability inform it, no auto-score overrides it." live
        actions={<><Badge tone={h?.status === "open" ? "ok" : "critical"}>{h?.status ?? "…"}</Badge>{freshMin !== null && <Badge tone={freshMin > 5 ? "stale" : "neutral"}>updated {freshMin} min ago</Badge>}</>} />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={BedDouble} label="ED beds free" value={h ? `${h.edAvail}/${h.edTotal}` : "—"} sub={`${edPct}% available`} tone={edPct > 25 ? "ok" : "critical"} />
        <Stat icon={HeartPulse} label="ICU beds free" value={h ? `${h.icuAvail}/${h.icuTotal}` : "—"} sub={`${icuPct}% available`} tone={icuPct > 25 ? "ok" : "critical"} />
        <Stat icon={Siren} label="Incoming" value={d?.incident ? code : "—"} sub={d?.incident ? `${d.incident.category ?? ""} · ${d.incident.priority ?? ""}` : "no ambulance en route"} tone="urgent" />
        <Stat icon={CheckCircle2} label="Handover" value={d?.handover?.status ?? "pending"} sub={d?.handover ? "summary on file" : "awaiting EMT"} tone={d?.handover?.status === "accepted" ? "ok" : "neutral"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Live capacity" sub="Reported beds. Stale numbers are flagged, never hidden.">
          <div className="space-y-3 text-sm">
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Emergency department</span><span className="font-mono">{h?.edAvail}/{h?.edTotal}</span></div>
              <ProgressBar value={edPct} tone={edPct > 25 ? "bg-ok" : "bg-critical"} />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-400"><span>Intensive care</span><span className="font-mono">{h?.icuAvail}/{h?.icuTotal}</span></div>
              <ProgressBar value={icuPct} tone={icuPct > 25 ? "bg-ok" : "bg-critical"} />
            </div>
            <p className="text-xs text-slate-500">Required capabilities for {code}: <span className="text-slate-300">{(d?.incident?.requiredCapabilities ?? ["ventilator"]).join(", ")}</span>. Verify ventilator / ICU availability before accepting.</p>
          </div>
        </Section>

        <Section title="Incoming ambulance" sub={`Status: ${d?.incident?.status ?? "…"}`}>
          {d?.incident ? (
            <div className="space-y-2 text-xs">
              <dl className="grid grid-cols-2 gap-1.5">
                {[["Incident", code], ["Pickup", d.incident.addressText ?? "—"], ["Category", d.incident.category ?? "—"], ["Needs", (d.incident.requiredCapabilities ?? []).join(", ") || "—"]].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/[0.03] p-2.5"><dt className="text-slate-500">{k}</dt><dd className="mt-0.5 font-medium text-slate-100">{v}</dd></div>
                ))}
              </dl>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-primary" disabled={busy} onClick={() => act("/api/handover/ack?kind=bed", { incidentCode: code, decision: "accept" })}>Accept + reserve bed</button>
                <button className="btn-ghost" disabled={busy} onClick={() => act("/api/handover/ack?kind=bed", { incidentCode: code, decision: "escalate" })}>Escalate / divert</button>
              </div>
            </div>
          ) : <p className="text-xs text-slate-500">Loading…</p>}
        </Section>
      </div>

      <Section title="Handover from EMT" sub="Fictional demo data. Acknowledge only after reviewing vitals.">
        {d?.handover ? (
          <div className="space-y-2">
            <p className="rounded-lg bg-white/[0.03] p-3 text-xs text-slate-300">{d.handover.summary}</p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {Object.entries(d.handover.vitals).map(([k, v]) => (
                <div key={k} className="rounded bg-white/[0.03] px-2 py-1.5 text-xs"><div className="text-slate-500">{k}</div><div className="font-mono font-medium text-slate-100">{v}</div></div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" disabled={busy} onClick={() => act("/api/handover/ack", { incidentCode: code, decision: "accept" })}>Acknowledge handover</button>
              <button className="btn-ghost" disabled={busy} onClick={() => act("/api/handover/ack", { incidentCode: code, decision: "escalate" })}>Escalate care</button>
              <button className="btn-ghost" disabled={busy} onClick={() => { refresh(); setMsg("Refreshed."); }}><RefreshCw size={14} /> Refresh</button>
            </div>
            {msg && <p className="text-xs text-slate-300">{msg}</p>}
          </div>
        ) : <p className="text-xs text-slate-500">No handover drafted yet — the EMT sends vitals + notes from /emt first.</p>}
      </Section>

      <Section title="Department activity" sub="Live incident + handover events for this case.">
        <Timeline items={(d?.incident?.timeline ?? []).map((t) => ({ at: t.at, title: t.event, detail: `${t.by} — ${t.detail}` }))} empty="No activity yet." />
      </Section>

      <p className="flex items-center gap-2 text-[11px] text-slate-600"><Building2 size={12} /> Light-surface clinical view · all demo data fictional · decisions are human, audited, reversible.</p>
    </main>
  );
}
