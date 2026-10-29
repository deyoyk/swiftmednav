"use client";
import { useEffect, useState } from "react";
import { Ambulance, Fuel, Wrench } from "lucide-react";
import { Badge, EmptyState, PageHeader, Section, Stat } from "@/components/ui";

interface Amb { vehicleId: string; type: string; capabilities: string[]; status: string; nodeId: string; freshnessSec: number }

export default function Fleet() {
  const [f, setF] = useState<Amb[]>([]);
  const [msg, setMsg] = useState("Loading fleet…");
  const refresh = async () => {
    const r = await fetch("/api/fleet").then((x) => x.json()).catch(() => null);
    if (r?.ok) { setF(r.data.ambulances); setMsg(""); }
    else setMsg("Could not load fleet.");
  };
  useEffect(() => { refresh(); const es = new EventSource("/api/stream"); es.onmessage = refresh; return () => es.close(); }, []);
  const avail = f.filter((a) => a.status === "available").length;
  const types = [...new Set(f.map((a) => a.type))].join(" · ");

  return (
    <main className="space-y-4">
      <PageHeader eyebrow="Fleet operations" title="Ambulance fleet" sub="Live unit status, capability mix and data freshness. Register and maintain units through the fleet desk." live
        actions={<Badge tone={avail > 0 ? "ok" : "critical"}>{avail}/{f.length} available</Badge>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Ambulance} label="Fleet strength" value={`${f.length} units`} sub={types || "—"} tone="info" />
        <Stat icon={Fuel} label="Ready now" value={`${avail} available`} sub={f.length ? `${Math.round((avail / f.length) * 100)}% of fleet` : "—"} tone={avail > 0 ? "ok" : "critical"} />
        <Stat icon={Wrench} label="Capabilities" value={`${new Set(f.flatMap((a) => a.capabilities)).size} tracked`} sub="oxygen, ventilator, …" tone="neutral" />
      </div>
      <Section title="Units" sub="Tap a unit to see where it is staged. Assignment happens from /dispatch.">
        {f.length === 0 ? <EmptyState title={msg || "No units"} body="Seed the demo data to load AMB-A/B/C." /> : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
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
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </main>
  );
}
