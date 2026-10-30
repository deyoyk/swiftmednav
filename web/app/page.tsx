import Link from "next/link";
import { Ambulance, BrainCircuit, Building2, ClipboardList, FlaskConical, HeartPulse, LayoutDashboard, LineChart, MapPinned, Siren } from "lucide-react";

const CARDS: { title: string; href: string; desc: string; icon: typeof Siren; accent: string }[] = [
  { title: "Dispatch command", href: "/dispatch", desc: "Live queue, OSRM road routes, A* ranking with explanations, approve / override.", icon: LayoutDashboard, accent: "text-red-400" },
  { title: "Citizen request", href: "/request", desc: "Report a simulated incident (EN/TA), GPS capture, live tracking + ETA.", icon: Siren, accent: "text-red-400" },
  { title: "Driver", href: "/driver", desc: "Run control: accept, status chain, comms, live timeline.", icon: Ambulance, accent: "text-sky-400" },
  { title: "EMT", href: "/emt", desc: "Vitals, timestamped notes, hospital notification (fictional).", icon: HeartPulse, accent: "text-emerald-400" },
  { title: "Hospital", href: "/hospital", desc: "Bed capacity, incoming ambulance, accept / escalate, handover ack.", icon: Building2, accent: "text-emerald-400" },
  { title: "Fleet", href: "/fleet", desc: "Units, capability mix, readiness and data freshness.", icon: ClipboardList, accent: "text-slate-300" },
  { title: "Digital twin", href: "/simulation", desc: "Scenario presets, congestion control, 3-strategy comparison.", icon: FlaskConical, accent: "text-amber-400" },
  { title: "Analytics", href: "/analytics", desc: "Simulated metrics, category + utilization charts, CSV export.", icon: LineChart, accent: "text-sky-400" },
  { title: "Explainable AI", href: "/explain", desc: "Ranking forensics, A* traces, Random Forest model card.", icon: BrainCircuit, accent: "text-violet-400" },
];

const FLOW = ["Citizen reports", "A* ranks ambulances", "Dispatcher approves", "Driver + EMT run", "Hospital handover", "Analytics + audit"];

export default function Home() {
  return (
    <main className="space-y-6">
      <header className="card relative overflow-hidden p-6 sm:p-8" style={{ backgroundImage: "radial-gradient(rgba(148,163,184,0.13) 1px, transparent 1px)", backgroundSize: "18px 18px" }}>
        <div className="absolute inset-x-0 top-0 h-0.5 bg-red-500/70" />
        <p className="badge border-white/15 bg-white/5 text-slate-300">SwiftMedNav · CSE (AI/ML) academic demo</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Emergency coordination, <span className="text-slate-400">simulated</span> end-to-end.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">OSRM road routing + A* search + Random Forest congestion prediction + explainable dispatch, over a Chennai digital twin. Every screen below is live — sign in and run the full loop.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-primary" href="/login">Sign in as a role</Link>
          <Link className="btn-ghost" href="/request"><MapPinned size={15} /> Report incident</Link>
          <Link className="btn-ghost" href="/dispatch">Open dispatch</Link>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          {FLOW.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{i + 1}. {s}</span>
              {i < FLOW.length - 1 && <span className="text-slate-700">→</span>}
            </span>
          ))}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="card group p-5 transition hover:-translate-y-0.5 hover:border-white/25">
            <c.icon size={20} className={c.accent} />
            <div className="mt-2 font-medium group-hover:text-white">{c.title}</div>
            <div className="mt-1 text-sm leading-relaxed text-slate-400">{c.desc}</div>
          </Link>
        ))}
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="text-sm font-semibold">New here? Run the 2-minute viva demo.</div>
          <div className="mt-0.5 text-xs text-slate-500">Request → dispatch → approve → driver → hospital → analytics. Docs in <code>docs/07-demo-script.md</code>.</div>
        </div>
        <div className="flex gap-2">
          <Link className="btn-primary" href="/login">Start demo</Link>
          <Link className="btn-ghost" href="/explain">How it decides</Link>
        </div>
      </div>
    </main>
  );
}
