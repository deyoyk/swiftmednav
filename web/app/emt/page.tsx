"use client";
import { useEffect, useState } from "react";
import { Activity, BellRing, ClipboardList, HeartPulse, NotebookPen } from "lucide-react";
import { Badge, EmptyState, Field, PageHeader, Section, Stat, Timeline } from "@/components/ui";

const VITALS_META: Record<string, { label: string; unit: string; ref: string }> = {
  bp: { label: "Blood pressure", unit: "mmHg", ref: "90–120 / 60–80" },
  pulse: { label: "Pulse", unit: "bpm", ref: "60–100" },
  spo2: { label: "SpO₂", unit: "%", ref: "95–100" },
  rr: { label: "Resp. rate", unit: "/min", ref: "12–20" },
  gcs: { label: "GCS", unit: "/15", ref: "15" },
  tempC: { label: "Temp", unit: "°C", ref: "36.1–37.2" },
};

interface Handover { incidentCode: string; vitals: Record<string, string>; notes: { at: string; by: string; text: string }[]; status: string; summary: string }

export default function Emt() {
  const [code] = useState("INC-DEMO-001");
  const [vitals, setVitals] = useState<Record<string, string>>({ bp: "120/80", pulse: "92", spo2: "97", rr: "18", gcs: "15", tempC: "37.0" });
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [h, setH] = useState<Handover | null>(null);

  const refresh = async () => {
    const r = await fetch(`/api/incidents/${code}`).then((x) => x.json()).catch(() => null);
    if (r?.ok && r.data.handover) setH(r.data.handover);
  };
  useEffect(() => { refresh(); const es = new EventSource("/api/stream"); es.onmessage = refresh; return () => es.close(); }, [code]);

  async function notify() {
    setBusy(true);
    try {
      const r = await fetch("/api/handover/notify", { method: "POST", headers: { "Content-Type": "application/json", "x-actor": "emt" }, body: JSON.stringify({ incidentCode: code, vitals, note }) });
      const j = await r.json();
      setMsg(j.ok ? `Hospital notified: ${j.data.summary}` : `Error: ${j.error}`);
      setNote("");
      refresh();
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow="Emergency medical technician" title={`Patient care — ${code}`} sub="Fictional demo data only. Document assessment, vitals and handover — no autonomous diagnosis or treatment decisions." live
        actions={h ? <Badge tone={h.status === "accepted" ? "ok" : h.status === "escalated" ? "critical" : "info"}>handover {h.status}</Badge> : <Badge tone="neutral">no handover yet</Badge>} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={HeartPulse} label="Documented vitals sets" value={h ? "1" : "0"} sub="this incident" tone="info" />
        <Stat icon={NotebookPen} label="Care notes" value={String(h?.notes.length ?? 0)} sub="timestamped entries" tone="info" />
        <Stat icon={BellRing} label="Hospital link" value={h ? h.status : "not notified"} sub="handover channel" tone={h?.status === "accepted" ? "ok" : "urgent"} />
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="md:col-span-3">
          <Section title="Vital signs" sub="Enter observed values. Reference ranges shown for documentation context only." actions={<Activity size={15} className="text-slate-500" />}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(VITALS_META).map(([k, m]) => (
                <Field key={k} label={`${m.label} (${m.unit})`} hint={`ref ${m.ref}`}>
                  <input className="input mt-1 font-mono" value={vitals[k] ?? ""} onChange={(e) => setVitals({ ...vitals, [k]: e.target.value })} />
                </Field>
              ))}
            </div>
          </Section>
        </div>
        <div className="md:col-span-2">
          <Section title="Assessment summary" sub="Auto-built from your entries.">
            {h ? (
              <div className="space-y-2 text-xs">
                <p className="rounded-lg bg-white/[0.03] p-2.5 text-slate-300">{h.summary}</p>
                <dl className="grid grid-cols-2 gap-1.5">
                  {Object.entries(h.vitals).map(([k, v]) => (
                    <div key={k} className="rounded bg-white/[0.03] px-2 py-1.5"><dt className="text-slate-500">{VITALS_META[k]?.label ?? k}</dt><dd className="font-mono font-medium text-slate-100">{v}</dd></div>
                  ))}
                </dl>
              </div>
            ) : <EmptyState title="No handover drafted" body="Enter vitals and notify the hospital to generate the summary." />}
          </Section>
        </div>
      </div>

      <Section title="Care notes + hospital notification" sub="Each note is timestamped and attributed. Notify sends vitals + notes to the receiving hospital.">
        <Field label="New timestamped care note">
          <textarea className="input mt-1" rows={3} placeholder="e.g. 14:32 — patient conscious, bleeding controlled, ventilator support on…" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button className="btn-primary w-full" disabled={busy} onClick={notify}><ClipboardList size={16} /> {busy ? "Sending…" : "Notify hospital + save handover"}</button>
        {msg && <p className="text-xs text-emerald-300">{msg}</p>}
      </Section>

      <Section title="Note history" sub="Newest last. Synced live.">
        <Timeline items={(h?.notes ?? []).map((n) => ({ at: n.at, title: n.by, detail: n.text }))} empty="No notes recorded yet." />
      </Section>
    </main>
  );
}
