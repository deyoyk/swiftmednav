"use client";
import { useEffect, useState } from "react";
import { Crosshair, Languages, PhoneCall, Send } from "lucide-react";
import { Badge, EmptyState, Field, PageHeader, Section, Stat, Timeline, statusTone } from "@/components/ui";

const CATS: [string, string][] = [["accident", "Road accident"], ["cardiac", "Cardiac"], ["trauma", "Trauma"], ["other", "Other"]];
const CATS_TA: [string, string][] = [["accident", "சாலை விபத்து"], ["cardiac", "இதயம்"], ["trauma", "காயம்"], ["other", "மற்றவை"]];
const T = {
  en: { title: "Request emergency help", sub: "Not connected to 108. Cannot summon a real ambulance. Demo requests stay inside this simulation.", send: "Submit simulated request", tracked: "Your request", catLabel: "What happened?", phone: "Callback number", addr: "Incident location", desc: "Anything responders should know (optional)" },
  ta: { title: "அவசர உதவி கோரிக்கை", sub: "108 உடன் இணைக்கப்படவில்லை. உண்மையான ஆம்புலன்ஸ் வராது. சோதனை கோரிக்கைகள் இந்த செயல்முறைக்குள் மட்டுமே.", send: "சோதனை கோரிக்கையை அனுப்பு", tracked: "உங்கள் கோரிக்கை", catLabel: "என்ன நடந்தது?", phone: "திரும்ப அழைக்க வேண்டிய எண்", addr: "சம்பவ இடம்", desc: "மீட்புக் குழுவுக்குத் தேவையான தகவல் (விருப்பம்)" },
};

interface Tracked { code: string; status: string; priority?: string; category?: string; addressText?: string; timeline: { at: string; by: string; event: string; detail: string }[]; assignment?: { vehicleId: string; status: string } | null; route?: { costSec: number; distanceKm: number } | null }

export default function RequestPage() {
  const [lang, setLang] = useState<"en" | "ta">("en");
  const [phone, setPhone] = useState("+91-98400-00001");
  const [addr, setAddr] = useState("Anna Nagar 2nd Ave (SIMULATED)");
  const [cat, setCat] = useState("accident");
  const [desc, setDesc] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tracked, setTracked] = useState<Tracked | null>(null);
  const t = T[lang];

  const refreshTracked = async (code: string) => {
    const r = await fetch(`/api/incidents/${code}`).then((x) => x.json()).catch(() => null);
    if (r?.ok) setTracked({ code, status: r.data.incident.status, priority: r.data.incident.priority, category: r.data.incident.category, addressText: r.data.incident.addressText, timeline: r.data.incident.timeline ?? [], assignment: r.data.assignment ?? null, route: r.data.route ?? null });
  };
  useEffect(() => {
    if (!tracked) return;
    const c = tracked.code;
    const id = setInterval(() => refreshTracked(c), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracked?.code]);

  async function submit() {
    setBusy(true); setMsg("");
    try {
      const gps = await new Promise<{ lat?: number; lng?: number }>((res) => {
        if (!navigator.geolocation) return res({});
        navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res({}), { timeout: 3000 });
      });
      const r = await fetch("/api/incidents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: cat, priority: "critical", contactPhone: phone, addressText: addr, description: desc || undefined, ...gps, requiredCapabilities: ["ventilator"] }) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "validation failed");
      setMsg(`${j.data.code} created — track it below (SIMULATED).`);
      refreshTracked(j.data.code);
    } catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : "failed"}`); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4">
      <PageHeader eyebrow={lang === "en" ? "Citizen" : "குடிமகன்"} title={t.title} sub={t.sub}
        actions={<button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setLang(lang === "en" ? "ta" : "en")}><Languages size={14} /> {lang === "en" ? "தமிழ்" : "English"}</button>} />

      <div className="grid gap-4 md:grid-cols-2">
        <Section title={t.catLabel} sub="Choose the closest category.">
          <div className="grid grid-cols-2 gap-2">
            {(lang === "en" ? CATS : CATS_TA).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setCat(v)} className={`rounded-lg border px-3 py-3 text-sm font-medium transition ${cat === v ? "border-red-500/60 bg-red-500/10 text-red-100" : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/25"}`}>{label}</button>
            ))}
          </div>
          <Field label={t.phone}><input className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></Field>
          <Field label={t.addr} hint="GPS is used with permission; otherwise this address is used.">
            <div className="mt-1 flex gap-2">
              <input className="input" value={addr} onChange={(e) => setAddr(e.target.value)} />
              <button type="button" className="btn-ghost shrink-0 px-3" title="Use GPS location" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setAddr(`GPS ${p.coords.latitude.toFixed(4)},${p.coords.longitude.toFixed(4)} (SIMULATED)`))}><Crosshair size={15} /></button>
            </div>
          </Field>
          <Field label={t.desc}><textarea className="input mt-1" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          <button className="btn-danger w-full py-3.5 text-base" disabled={busy} onClick={submit}><Send size={16} /> {busy ? "…" : t.send}</button>
          {msg && <p className="text-xs text-emerald-300">{msg}</p>}
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><PhoneCall size={12} /> A dispatcher will call back on the number above (simulated).</p>
        </Section>

        <Section title={t.tracked} sub="Live status, assignment and ETA. Refreshes automatically.">
          {!tracked ? <EmptyState title="No active request" body="Submit the form to create a simulated incident and track it here." /> : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{tracked.code}</span>
                <Badge tone={statusTone(tracked.status)}>{tracked.status}</Badge>
                {tracked.priority && <Badge tone={tracked.priority === "critical" ? "critical" : "urgent"}>{tracked.priority}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white/[0.03] p-2.5"><div className="text-slate-500">Ambulance</div><div className="mt-0.5 font-medium text-slate-100">{tracked.assignment ? `${tracked.assignment.vehicleId} · ${tracked.assignment.status}` : "awaiting dispatch…"}</div></div>
                <div className="rounded-lg bg-white/[0.03] p-2.5"><div className="text-slate-500">ETA</div><div className="mt-0.5 font-medium text-slate-100">{tracked.route ? `${Math.round(tracked.route.costSec / 60)} min · ${tracked.route.distanceKm} km` : "—"}</div></div>
              </div>
              <Timeline items={tracked.timeline.map((e) => ({ at: e.at, title: e.event, detail: e.detail }))} empty="Created — waiting for dispatcher." />
              <button className="btn-ghost w-full text-xs" onClick={() => refreshTracked(tracked.code)}>Refresh now</button>
            </div>
          )}
        </Section>
      </div>
    </main>
  );
}
