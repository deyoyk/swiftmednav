"use client";
import Link from "next/link";
import { useState } from "react";
import { KeyRound, LogIn, ShieldCheck } from "lucide-react";
import { ROLE_HOME } from "@/lib/roles";

type LoginResp = { ok?: boolean; data?: { role?: string; name?: string }; error?: string };
const QUICK: [string, string, string][] = [
  ["dispatch@demo.local", "Dispatcher", "command center"],
  ["driver-b@demo.local", "Driver", "run control"],
  ["emt@demo.local", "EMT", "patient care"],
  ["hosp@demo.local", "Hospital", "bed desk"],
  ["citizen@demo.local", "Citizen", "request + track"],
  ["super@demo.local", "Admin", "console"],
];

export default function Login() {
  const [email, setEmail] = useState("dispatch@demo.local");
  const [password, setPassword] = useState("demo1234");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function quick(roleEmail: string) {
    setEmail(roleEmail); setPassword("demo1234"); setMsg(""); setBusy(true);
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: roleEmail, password: "demo1234" }) });
      const j = (await r.json().catch(() => null)) as LoginResp | null;
      if (!r.ok || !j?.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      const home = ROLE_HOME[j.data?.role ?? ""] ?? "/";
      setMsg(`Signed in as ${j.data?.name ?? roleEmail} (${j.data?.role}). Redirecting…`);
      window.location.href = home;
    } catch (e) {
      setMsg(`Login failed: ${e instanceof Error ? e.message : "unknown"} — run seed + check MongoDB.`);
    } finally { setBusy(false); }
  }
  return (
    <main className="mx-auto grid max-w-4xl gap-4 py-6 md:grid-cols-5">
      <div className="card space-y-4 p-6 md:col-span-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><KeyRound size={19} className="text-slate-400" /> Sign in</h1>
          <p className="mt-1 text-xs text-slate-500">Each account opens its own role dashboard. Pick a one-click login or type credentials.</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); quick(email); }} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" aria-label="Email" />
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" aria-label="Password" />
          <button className="btn-primary sm:col-span-1" disabled={busy}><LogIn size={15} /> {busy ? "…" : "Go"}</button>
        </form>
        {msg && <p className="text-xs text-slate-300">{msg}</p>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {QUICK.map(([em, label, sub]) => (
            <button key={em} type="button" disabled={busy} onClick={() => quick(em)} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left transition hover:border-white/30 hover:bg-white/[0.05]">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-[11px] text-slate-500">{sub}</div>
              <div className="mt-1 font-mono text-[10px] text-slate-600">{em}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="card space-y-3 p-6 md:col-span-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={16} className="text-emerald-400" /> Demo accounts</h2>
        <p className="text-xs leading-relaxed text-slate-400">All demo passwords are <code className="font-mono text-slate-300">demo1234</code>. Seed them first with <code className="font-mono text-slate-300">npm run seed</code> (needs MongoDB). Sessions are httpOnly cookies, passwords bcrypt-hashed, routes server-side role-checked.</p>
        <div className="space-y-1.5 text-xs">
          {[["Dispatcher", "approve, override, closures"], ["Driver / EMT", "run chain, vitals, handover"], ["Hospital", "beds, accept, ack"], ["Citizen", "report + live tracking"], ["Admin", "users, audit, analytics"]].map(([t, d]) => (
            <div key={t} className="flex justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5"><span className="font-medium text-slate-200">{t}</span><span className="text-right text-slate-500">{d}</span></div>
          ))}
        </div>
        <Link className="btn-ghost w-full text-xs" href="/">← Back to overview</Link>
      </div>
    </main>
  );
}
