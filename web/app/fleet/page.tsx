"use client";
import { useEffect, useState } from "react";
import { Ambulance, Fuel, PlusCircle, Wrench } from "lucide-react";
import { Badge, EmptyState, Field, PageHeader, Section, Stat } from "@/components/ui";

interface Amb { vehicleId: string; type: string; capabilities: string[]; status: string; nodeId: string; freshnessSec: number }

const TYPES = ["BLS", "ALS", "NEONATAL", "SPECIALIST"];
const STATUSES = ["available", "maintenance", "offline", "breakdown"];
const NODES = ["A-base", "N1", "N2", "N3", "B-base", "N4", "INC", "HOSP"];

export default function Fleet() {
  const [f, setF] = useState<Amb[]>([]);
  const [msg, setMsg] = useState("Loading fleet…");
  const [form, setForm] = useState({ vehicleId: "", type: "BLS", capabilities: "oxygen", nodeId: "A-base" });
  const [formMsg, setFormMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    const r = await fetch("/api/fleet").then((x) => x.json()).catch(() => null);
    if (r?.ok) { setF(r.data.ambulances); setMsg(""); }
    else setMsg("Could not load fleet.");
  };
  useEffect(() => { refresh(); const es = new EventSource("/api/stream"); es.onmessage = refresh; return () => es.close(); }, []);
  const avail = f.filter((a) => a.status === "available").length;
  const types = [...new Set(f.map((a) => a.type))].join(" · ");

  async function register(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setFormMsg("");
    try {
      const r = await fetch("/api/fleet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, capabilities: form.capabilities.split(",").map((c) => c.trim()).filter(Boolean) }) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setFormMsg(`Registered ${j.data.vehicleId}.`);
      setForm({ vehicleId: "", type: "BLS", capabilities: "oxygen", nodeId: "A-base" });
      refresh();
    } catch (err) {
      setFormMsg(`Register failed: ${err instanceof Error ? err.message : "unknown"} — sign in as dispatcher or admin.`);
    } finally { setBusy(false); }
  }
  async function setStatus(vehicleId: string, status: string) {
    const r = await fetch("/api/fleet", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleId, status }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) setMsg(`Status change failed: ${j?.error ?? r.status} — sign in as dispatcher or admin.`);
    refresh();
  }

  return (
    <main className="space-y-4">
      <PageHeader eyebrow="Fleet operations" title="Ambulance fleet" sub="Live unit status, capability mix and data freshness. Register and maintain units through the fleet desk." live
        actions={<Badge tone={avail > 0 ? "ok" : "critical"}>{avail}/{f.length} available</Badge>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Ambulance} label="Fleet strength" value={`${f.length} units`} sub={types || "—"} tone="info" />
        <Stat icon={Fuel} label="Ready now" value={`${avail} available`} sub={f.length ? `${Math.round((avail / f.length) * 100)}% of fleet` : "—"} tone={avail > 0 ? "ok" : "critical"} />
        <Stat icon={Wrench} label="Capabilities" value={`${new Set(f.flatMap((a) => a.capabilities)).size} tracked`} sub="oxygen, ventilator, …" tone="neutral" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Units" sub="Change status to take a unit offline for maintenance. Units on an active run cannot be stood down.">
            {f.length === 0 ? <EmptyState title={msg || "No units"} body="Seed the demo data to load AMB-A/B/C." /> : (
              <div className="grid gap-2 md:grid-cols-2">
                {f.map((a) => {
                  const stale = a.freshnessSec > 300;
                  return (
                    <div key={a.vehicleId} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/25">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-semibold"><Ambulance size={17} className="text-slate-400" />{a.vehicleId}</span>
                        <Badge tone={a.status === "available" ? "ok" : "info"}>{a.status}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="badge border-white/15 bg-white/5">{a.type}</span>
                        <span className="badge border-white/15 bg-white/5">staged {a.nodeId}</span>
                        <span className={`badge ${stale ? "border-amber-500/40 bg-amber-500/10 text-amber-200" : "border-white/15 bg-white/5"}`}>fix {a.freshnessSec}s</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {a.capabilities.map((c) => <span key={c} className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-200">{c}</span>)}
                      </div>
                      <select className="input mt-2 py-1.5 text-xs" value={a.status} onChange={(e) => setStatus(a.vehicleId, e.target.value)} aria-label={`Status for ${a.vehicleId}`}>
                        {["available", "assigned", "enroute", ...STATUSES.filter((s) => !["available", "assigned", "enroute"].includes(s))].map((s) => <option key={s} value={s}>{s}{["assigned", "enroute"].includes(s) ? " (auto)" : ""}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
            {msg && f.length > 0 && <p className="text-xs text-amber-300">{msg}</p>}
          </Section>
        </div>
        <Section title="Register unit" sub="Adds to dispatch recommendations immediately.">
          <form onSubmit={register} className="grid gap-2">
            <Field label="Vehicle ID"><input className="input mt-1 font-mono" placeholder="AMB-D" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value.toUpperCase() })} required /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type"><select className="input mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
              <Field label="Staged at"><select className="input mt-1" value={form.nodeId} onChange={(e) => setForm({ ...form, nodeId: e.target.value })}>{NODES.map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
            </div>
            <Field label="Capabilities (comma separated)" hint="e.g. oxygen, ventilator"><input className="input mt-1" value={form.capabilities} onChange={(e) => setForm({ ...form, capabilities: e.target.value })} /></Field>
            <button className="btn-primary w-full" disabled={busy}><PlusCircle size={15} /> {busy ? "Registering…" : "Register unit"}</button>
            {formMsg && <p className="text-xs text-slate-300">{formMsg}</p>}
          </form>
        </Section>
      </div>
    </main>
  );
}
