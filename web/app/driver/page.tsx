"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Volume2, VolumeX } from "lucide-react";
import type { RoadGeometry } from "@/components/DriverMap";

const DriverMap = dynamic(() => import("@/components/DriverMap"), { ssr: false });

const CODE = "INC-DEMO-001";
const INC: [number, number] = [80.221, 13.088]; // [lng, lat]
const HOSP: [number, number] = [80.225, 13.082];
const BASES: Record<string, [number, number]> = {
  "AMB-A": [80.209, 13.087],
  "AMB-B": [80.228, 13.095],
  "AMB-C": [80.212, 13.089],
};
const NEXT: Record<string, { to: string; label: string }> = {
  acknowledged: { to: "enroute", label: "Start driving" },
  enroute: { to: "onscene", label: "Arrived at scene" },
  onscene: { to: "onboard", label: "Patient onboard" },
  onboard: { to: "athospital", label: "Arrived at hospital" },
  athospital: { to: "handover", label: "Begin handover" },
  handover: { to: "completed", label: "Complete handover" },
};
const DRIVING = new Set(["enroute", "onboard"]);

interface Detail { incident?: { status: string; addressText?: string; priority?: string }; assignment?: { vehicleId: string; status: string } | null }

function haversineM(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function posAt(line: [number, number][], d: number): [number, number] {
  // line is [lat, lng]
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const seg = haversineM(a[1], a[0], b[1], b[0]);
    if (acc + seg >= d) {
      const f = seg === 0 ? 0 : (d - acc) / seg;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    acc += seg;
  }
  const last = line[line.length - 1]!;
  return [last[0], last[1]];
}

function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function Driver() {
  const [d, setD] = useState<Detail | null>(null);
  const [road, setRoad] = useState<RoadGeometry | null>(null);
  const [traveled, setTraveled] = useState(0);
  const [voice, setVoice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const announced = useRef<Set<string>>(new Set());
  const audioUnlocked = useRef(false);

  const status = d?.incident?.status ?? "?";
  const vehicle = d?.assignment?.vehicleId ?? "AMB-B";
  const phase: 1 | 2 = ["onboard", "athospital", "handover", "completed"].includes(status) ? 2 : 1;
  const base = BASES[vehicle] ?? BASES["AMB-B"]!;
  const waypoints: [number, number][] = phase === 1 ? [base, INC] : [INC, HOSP];
  const destName = phase === 1 ? "Scene" : "Hospital";

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/incidents/${CODE}`).then((x) => x.json()).catch(() => null);
    if (r?.ok) setD(r.data);
  }, []);
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  // reset trip when the leg changes
  const phaseRef = useRef(phase);
  useEffect(() => {
    if (phaseRef.current !== phase) {
      phaseRef.current = phase;
      setTraveled(0);
      setRoad(null);
      announced.current = new Set();
    }
  }, [phase]);

  const total = road?.distanceM ?? 0;
  const speed = road && road.durationS > 0 ? road.distanceM / road.durationS : 11;
  const remaining = Math.max(0, total - traveled);
  const etaMin = speed > 0 && total > 0 ? Math.max(1, Math.round(remaining / speed / 60)) : null;
  const pos = road && road.line.length > 1 ? posAt(road.line, Math.min(traveled, total)) : null;

  function speak(text: string) {
    if (!voice || !audioUnlocked.current || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    } catch { /* voice is best-effort */ }
  }

  // simulated GPS ticker + maneuver announcements
  useEffect(() => {
    if (!road || !DRIVING.has(status)) return;
    const id = setInterval(() => {
      setTraveled((t) => {
        const nt = Math.min(t + speed * 1, total || t + speed);
        const next = road.steps.find((s) => s.at > t - 5 && s.at <= nt + 150);
        if (next && !announced.current.has(next.text + next.at)) {
          announced.current.add(next.text + next.at);
          const away = Math.max(0, next.at - nt);
          speak(away < 40 ? `${next.text}` : `In ${fmtDist(away)}, ${next.text.charAt(0).toLowerCase() + next.text.slice(1)}`);
        }
        if (total > 0 && total - nt < 30 && !announced.current.has("arrived")) {
          announced.current.add("arrived");
          speak(`You have arrived at the ${phase === 1 ? "scene" : "hospital"}`);
        }
        return nt;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [road, status]);

  const nextStep = road?.steps.find((s) => s.at > traveled - 5) ?? null;
  const nextAway = nextStep ? Math.max(0, nextStep.at - traveled) : null;

  async function call(url: string, body: unknown) {
    audioUnlocked.current = true;
    setBusy(true);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-actor": "driver" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!j.ok) setMsg(`Error: ${j.error}`);
      refresh();
    } finally { setBusy(false); }
  }
  async function advance(to: string) {
    audioUnlocked.current = true;
    setBusy(true);
    try {
      const r = await fetch(`/api/incidents/${CODE}/status`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-actor": "driver" }, body: JSON.stringify({ to }) });
      const j = await r.json();
      if (j.ok) speak(to === "completed" ? "Run complete. Well done." : "Status updated");
      else setMsg(`Error: ${j.error}`);
      refresh();
    } finally { setBusy(false); }
  }

  const nx = NEXT[status];

  return (
    <main className="relative -mx-4 -my-6 h-[calc(100vh-64px)] min-h-[540px] overflow-hidden">
      <div className="absolute inset-0">
        <DriverMap waypoints={waypoints} pos={pos} onRoute={setRoad}
          maneuverDots={road?.steps.map((s) => s.location) ?? []}
          nextManeuver={nextStep?.location ?? null} />
      </div>

      {/* tiny status pill + mute: the only chrome besides the one action */}
      <div className="absolute left-3 right-3 top-3 z-[1100] flex items-center justify-between">
        <span className="rounded-full bg-ink-950/85 px-3 py-1.5 text-xs font-medium text-slate-100 backdrop-blur">
          {d?.assignment ? `${d.assignment.vehicleId} · ${status}` : "Waiting for dispatch…"}
        </span>
        <button
          aria-label={voice ? "Mute voice guidance" : "Unmute voice guidance"}
          onClick={() => { audioUnlocked.current = true; setVoice((v) => !v); if (voice && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }}
          className="rounded-full bg-ink-950/85 p-2.5 text-slate-200 backdrop-blur"
        >
          {voice ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      {/* Uber-style bottom sheet: glanceable, one giant touch target */}
      <div className="absolute inset-x-0 bottom-0 z-[1100] rounded-t-3xl border-t border-white/10 bg-ink-950/95 p-5 pb-6 backdrop-blur">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        {!d?.assignment ? (
          <div className="py-2 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
              <span className="relative flex h-2.5 w-2.5"><span className="absolute h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" /><span className="h-2.5 w-2.5 rounded-full bg-sky-400" /></span>
              Waiting for dispatch…
            </div>
            <p className="mt-1 text-xs text-slate-500">Keep this screen open. The run appears automatically.</p>
          </div>
        ) : d.assignment.status === "proposed" || d.assignment.status === "approved" ? (
          <div className="space-y-2">
            <p className="text-center text-sm text-slate-300">New run · {codeName(d)} · {d?.incident?.addressText ?? "Anna Nagar"}</p>
            <button className="btn-primary w-full py-5 text-xl font-semibold" disabled={busy} onClick={() => call(`/api/assignments/${CODE}/acknowledge`, { accept: true })}>
              {busy ? "…" : "ACCEPT RUN"}
            </button>
            <button className="mx-auto block text-xs text-slate-500 underline-offset-2 hover:underline" disabled={busy} onClick={() => call(`/api/assignments/${CODE}/acknowledge`, { accept: false, reason: "unable (logged)" })}>
              Reject run
            </button>
          </div>
        ) : status === "completed" ? (
          <div className="flex items-center justify-center gap-2 py-3 text-emerald-300">
            <CheckCircle2 size={22} /> <span className="text-lg font-semibold">Run complete — handover done</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-5xl font-bold tracking-tight text-white">{etaMin ?? "—"}<span className="ml-1 text-lg font-medium text-slate-400">min</span></div>
                <div className="mt-0.5 text-sm text-slate-400">{fmtDist(remaining)} to {destName}</div>
              </div>
              <div className="max-w-[55%] text-right">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Next</div>
                <div className="text-sm font-medium leading-snug text-slate-100">
                  {nextStep ? `${nextAway != null && nextAway > 1 ? `In ${fmtDist(nextAway)} — ` : ""}${nextStep.text}` : `Head to ${destName}`}
                </div>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${total > 0 ? Math.min(100, (traveled / total) * 100) : 0}%` }} />
            </div>
            {nx ? (
              <button className="btn-primary w-full py-5 text-xl font-semibold" disabled={busy} onClick={() => advance(nx.to)}>
                {busy ? "…" : nx.label.toUpperCase()}
              </button>
            ) : (
              <p className="py-2 text-center text-sm text-slate-400">Waiting for dispatcher…</p>
            )}
            {msg && <p className="text-center text-xs text-amber-300">{msg}</p>}
          </div>
        )}
      </div>
    </main>
  );
}

function codeName(d: { assignment?: { vehicleId: string } | null } | null): string {
  return d?.assignment?.vehicleId ?? "AMB";
}
