"use client";
import { useEffect, useRef, useState } from "react";
import { FlaskConical, GitCompareArrows, Pause, Play, RotateCcw, TrafficCone } from "lucide-react";
import { Badge, Field, PageHeader, Section, Stat } from "@/components/ui";

interface Compare { strategies: { name: string; pick: string; etaSec: number | null; note?: string }[] }
interface SimData { compare?: Compare; closures: string[]; seed?: number }

const PRESETS = [
  { name: "Rush hour", closures: [] as string[], mult: 4, blurb: "Heavy corridor load, all roads open" },
  { name: "Roadwork closure", closures: ["seg-a3-congested"], mult: 3, blurb: "N2→INC closed, traffic diverted" },
  { name: "Gridlock drill", closures: ["seg-a3-congested"], mult: 5, blurb: "Closure plus peak congestion" },
  { name: "Free flow", closures: [] as string[], mult: 1, blurb: "Night-time baseline" },
];

export default function Simulation() {
  const [data, setData] = useState<SimData | null>(null);
  const [mult, setMult] = useState(3);
  const [running, setRunning] = useState(true);
  const [msg, setMsg] = useState("");
  const refresh = async () => {
    const r = await fetch("/api/simulation/scenario").then((x) => x.json()).catch(() => null);
    if (r?.ok) setData(r.data);
  };
  const runningRef = useRef(running);
  runningRef.current = running;
  useEffect(() => { refresh(); const es = new EventSource("/api/stream"); es.onmessage = () => { if (runningRef.current) refresh(); }; return () => es.close(); }, []);
  async function apply(closures: string[], m = mult, label = "scenario updated") {
    setMsg("");
    const r = await fetch("/api/simulation/scenario", { method: "POST", headers: { "Content-Type": "application/json", "x-actor": "dispatcher" }, body: JSON.stringify({ closures, congestionMult: m }) });
    const j = await r.json().catch(() => null);
    setMsg(j?.ok ? `${label} (SIMULATED).` : `Error: ${j?.error ?? "failed"}`);
    refresh();
  }
  const strats = data?.compare?.strategies ?? [];
  const best = strats.reduce<{ name: string; etaSec: number | null } | null>((b, s) => (!b || (s.etaSec ?? Infinity) < (b.etaSec ?? Infinity) ? s : b), null);

  return (
    <main className="space-y-4">
      <PageHeader eyebrow="Research console" title="Digital twin" sub="Deterministic Chennai sandbox (seed 42). Same seed + same inputs ⇒ identical event log — replayable for the viva." live
        actions={<><Badge tone="neutral">seed {data?.seed ?? 42}</Badge><Badge tone={running ? "ok" : "urgent"}>{running ? "ticking" : "paused"}</Badge></>} />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={TrafficCone} label="Corridor load" value={`×${mult}`} sub="congestion multiplier" tone={mult >= 4 ? "critical" : mult >= 2 ? "urgent" : "ok"} />
        <Stat icon={FlaskConical} label="Closures" value={String(data?.closures.length ?? 0)} sub={(data?.closures ?? []).join(", ") || "all roads open"} tone={(data?.closures?.length ?? 0) ? "urgent" : "ok"} />
        <Stat icon={GitCompareArrows} label="Best strategy" value={best?.name.split("-")[0] ?? "—"} sub={best?.etaSec != null ? `ETA ${Math.round(best.etaSec / 60)} min` : "—"} tone="info" />
        <Stat icon={Play} label="Clock" value={running ? "running" : "paused"} sub="pause = freeze ticks" tone="neutral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Scenario presets" sub="One click reconfigures closures + load.">
            <div className="grid gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} className="btn-ghost justify-start text-left" onClick={() => { setMult(p.mult); apply(p.closures, p.mult, `Preset “${p.name}” applied`); }}>
                  <span><span className="block text-sm font-medium">{p.name}</span><span className="block text-xs text-slate-500">{p.blurb} · ×{p.mult}{p.closures.length ? " · closure" : ""}</span></span>
                </button>
              ))}
            </div>
          </Section>
          <Section title="Clock + load" sub="Manual controls.">
            <Field label={`Congestion multiplier (×${mult})`} hint="1 = free flow, 5 = gridlock drill">
              <input type="range" min={1} max={5} step={0.5} value={mult} onChange={(e) => setMult(Number(e.target.value))} className="w-full accent-red-500" />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <button className="btn-ghost" onClick={() => setRunning(!running)}>{running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}</button>
              <button className="btn-ghost" onClick={() => apply([])}><RotateCcw size={14} /> Reset</button>
              <button className="btn-ghost" onClick={() => { setMult(mult); apply(data?.closures ?? [], mult, "Load applied"); }}>Apply load</button>
            </div>
            {msg && <p className="text-xs text-slate-300">{msg}</p>}
          </Section>
        </div>
        <div className="lg:col-span-3">
          <Section title="Strategy comparison" sub="Same incident, three dispatch brains. SIMULATED estimates, not field measurements." wide
            actions={<Badge tone="neutral">deterministic</Badge>}>
            <div className="grid gap-2 sm:grid-cols-3">
              {strats.map((s) => {
                const isBest = best && s.name === best.name;
                return (
                  <div key={s.name} className={`rounded-xl border p-4 ${isBest ? "border-emerald-500/50 bg-emerald-500/[0.07]" : "border-white/10 bg-white/[0.02]"}`}>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">{s.name.replace(/-/g, " ")}</div>
                    <div className="mt-1 text-lg font-semibold">{s.pick}</div>
                    <div className="text-sm text-slate-400">{s.etaSec != null ? `ETA ${Math.round(s.etaSec / 60)} min` : "no route"}</div>
                    {s.note && <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{s.note}</p>}
                    {isBest && <div className="mt-2"><Badge tone="ok">recommended brain</Badge></div>}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-600">Nearest-distance ignores traffic · min-travel-time uses predicted congestion · capability-filtered traffic-aware also enforces clinical capability match + human approval.</p>
          </Section>
        </div>
      </div>
    </main>
  );
}
