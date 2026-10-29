"use client";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, History, PieChart as PieIcon, Timer } from "lucide-react";
import { Badge, EmptyState, PageHeader, Section, Stat, Timeline } from "@/components/ui";

interface Summary {
  totals: Record<string, number>;
  responseTimeMin: { p50: number; p90: number; note: string };
  categoryDist: Record<string, number>;
  utilization: { vehicle: string; assigned: number }[];
  congestionTrend: { seg: string; level: string; mult: number; source: string }[];
  auditCount: number;
  simulated: boolean;
}
interface Audit { at: string; actor: string; action: string; detail: string }

const PIE_COLORS = ["#38bdf8", "#22c55e", "#f59e0b", "#ef4444", "#a78bfa", "#94a3b8"];

export default function Analytics() {
  const [a, setA] = useState<Summary | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [msg, setMsg] = useState("Loading simulated metrics…");
  const refresh = async () => {
    const [s, u] = await Promise.all([
      fetch("/api/analytics/summary").then((x) => x.json()).catch(() => null),
      fetch("/api/analytics/audit").then((x) => x.json()).catch(() => null),
    ]);
    if (s?.ok) { setA(s.data); setMsg(""); } else setMsg("Could not load analytics.");
    if (u?.ok) setAudit(u.data);
  };
  useEffect(() => {
    refresh();
    const es = new EventSource("/api/stream");
    es.onmessage = refresh;
    return () => es.close();
  }, []);

  const catData = a ? Object.entries(a.categoryDist).map(([name, value]) => ({ name, value })) : [];
  const utilData = a ? a.utilization.map((u) => ({ name: u.vehicle, assigned: u.assigned })) : [];

  return (
    <main className="space-y-4">
      <PageHeader eyebrow="Operations intelligence" title="Analytics" sub="Every number below is computed from simulated incidents only — never presented as real-world performance." live
        actions={<a className="btn-ghost px-3 py-1.5 text-xs" href="/api/analytics/export"><Download size={14} /> CSV export</a>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Timer} label="Incidents (sim)" value={String(a?.totals.incidents ?? "—")} sub={`active ${a?.totals.active ?? "—"}`} tone="info" />
        <Stat icon={PieIcon} label="Response p50 / p90" value={a ? `${a.responseTimeMin.p50} / ${a.responseTimeMin.p90} min` : "—"} sub="A* estimate, demo graph" tone="neutral" />
        <Stat icon={History} label="Handovers done" value={String(a?.totals.completedHandovers ?? "—")} sub={`audit events ${a?.auditCount ?? "—"}`} tone="ok" />
        <Stat icon={Download} label="Fleet out" value={a ? `${a.utilization.filter((u) => u.assigned).length}/${a.utilization.length} assigned` : "—"} sub="current utilization" tone="urgent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Incidents by category" sub="Counts from the simulated incident log.">
          {catData.length ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={catData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#0a1226", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title={msg} />}
          <p className="text-[11px] text-slate-600">Proportions reflect the demo seed + your simulated reports — nothing here measures a real city.</p>
        </Section>

        <Section title="Fleet utilization" sub="Which units are currently committed.">
          {utilData.length ? (
            <div className="space-y-2.5">
              {utilData.map((u) => (
                <div key={u.name}>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-medium text-slate-200">{u.name}</span><Badge tone={u.assigned ? "urgent" : "ok"}>{u.assigned ? "on a run" : "available"}</Badge></div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${u.assigned ? "bg-urgent" : "bg-ok"}`} style={{ width: u.assigned ? "100%" : "8%" }} /></div>
                </div>
              ))}
            </div>
          ) : <EmptyState title={msg} />}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Response-time shape" sub={a?.responseTimeMin.note ?? "Estimated from A* on the demo graph."}>
          <div className="flex items-end gap-2">
            {[["p50", a?.responseTimeMin.p50 ?? 0, "bg-sky-400"], ["p90", a?.responseTimeMin.p90 ?? 0, "bg-urgent"]].map(([k, v, c]) => (
              <div key={k as string} className="flex-1 text-center">
                <div className="text-lg font-semibold">{v} min</div>
                <div className={`mx-auto mt-1 w-full rounded-t ${c}`} style={{ height: `${Math.max(8, Math.min(120, Number(v) * 8))}px` }} />
                <div className="mt-1 text-[11px] text-slate-500">{k}</div>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Congestion trend" sub="Corridor load multipliers driving routing right now.">
          {(a?.congestionTrend ?? []).map((c) => (
            <div key={c.seg} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] p-2.5 text-xs">
              <span className="font-mono text-slate-300">{c.seg}</span>
              <span className="flex items-center gap-1.5"><Badge tone={c.level === "high" ? "critical" : c.level === "medium" ? "urgent" : "ok"}>{c.level} ×{c.mult}</Badge><span className="text-slate-600">{c.source}</span></span>
            </div>
          ))}
        </Section>
      </div>

      <Section title={`Audit history (${audit.length})`} sub="Every dispatch decision, status change and override — newest first.">
        <div className="max-h-80 overflow-auto pr-1">
          <Timeline items={audit.slice(0, 60).map((e) => ({ at: e.at, title: `${e.actor} · ${e.action}`, detail: e.detail }))} empty="No audit events yet." />
        </div>
      </Section>
    </main>
  );
}
