"use client";
import type { LucideIcon } from "lucide-react";
import { Activity } from "lucide-react";
import type { ReactNode } from "react";

// ---------- Page header ----------
export function PageHeader({ eyebrow, title, sub, live, actions }: {
  eyebrow?: string; title: string; sub?: string; live?: boolean; actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {eyebrow && <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</span>}
          {live && (
            <span className="badge border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> LIVE
            </span>
          )}
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-slate-50">{title}</h1>
        {sub && <p className="max-w-2xl text-sm text-slate-400">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Stat card ----------
const TONE_BAR: Record<string, string> = {
  default: "bg-slate-400", critical: "bg-critical", urgent: "bg-urgent", ok: "bg-ok", info: "bg-sky-400",
};
export function Stat({ icon: Icon = Activity, label, value, sub, tone = "default" }: {
  icon?: LucideIcon; label: string; value: string; sub?: string; tone?: keyof typeof TONE_BAR | string;
}) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className={`absolute inset-y-0 left-0 w-1 ${TONE_BAR[tone] ?? TONE_BAR.default}`} />
      <div className="flex items-center justify-between gap-2 pl-2">
        <span className="text-xs text-slate-400">{label}</span>
        <Icon size={15} className="text-slate-500" />
      </div>
      <div className="mt-1 pl-2 font-display text-2xl font-semibold tracking-tight tnum">{value}</div>
      {sub && <div className="mt-0.5 pl-2 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

// ---------- Section card ----------
export function Section({ title, sub, actions, children, wide }: {
  title: string; sub?: string; actions?: ReactNode; children: ReactNode; wide?: boolean;
}) {
  return (
    <section className={`card space-y-3 ${wide ? "p-5" : "p-4"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

// ---------- Status badge ----------
const BADGE_TONE: Record<string, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-200",
  urgent: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  neutral: "border-white/15 bg-white/5 text-slate-300",
  stale: "border-amber-500/40 bg-amber-500/10 text-amber-200",
};
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof BADGE_TONE; children: ReactNode }) {
  return <span className={`badge ${BADGE_TONE[tone]}`}>{children}</span>;
}

export function statusTone(status: string): keyof typeof BADGE_TONE {
  if (["critical", "rejected", "escalated", "divert"].includes(status)) return "critical";
  if (["urgent", "pending", "proposed", "stale"].includes(status)) return "urgent";
  if (["available", "accepted", "acknowledged", "completed", "open", "notified"].includes(status)) return "ok";
  if (["assigned", "enroute", "onscene", "onboard", "athospital", "handover", "approved"].includes(status)) return "info";
  return "neutral";
}

// ---------- Data table ----------
export function DataTable({ head, children, minWidth = 640 }: { head: string[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-left text-xs" style={{ minWidth }}>
        <thead>
          <tr className="bg-white/[0.04] text-slate-400">
            {head.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Row({ children, sep = true }: { children: ReactNode; sep?: boolean }) {
  return <tr className={sep ? "border-t border-white/10 align-top transition hover:bg-white/[0.03]" : "align-top"}>{children}</tr>;
}

export function Cell({ children, muted, strong }: { children: ReactNode; muted?: boolean; strong?: boolean }) {
  return <td className={`px-3 py-2.5 ${muted ? "text-slate-500" : ""} ${strong ? "font-medium text-slate-100" : ""}`}>{children}</td>;
}

// ---------- Timeline feed ----------
export function Timeline({ items, empty = "No events yet." }: {
  items: { at?: string; title: string; detail?: string; tone?: keyof typeof BADGE_TONE }[]; empty?: string;
}) {
  if (!items.length) return <p className="text-xs text-slate-500">{empty}</p>;
  return (
    <ul className="relative ml-1.5 space-y-3 border-l border-white/10 pl-4">
      {items.map((t, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-ink-950 bg-slate-500" />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-200">{t.title}</span>
            {t.tone && <Badge tone={t.tone}>{t.tone}</Badge>}
          </div>
          {t.detail && <p className="mt-0.5 text-xs text-slate-400">{t.detail}</p>}
          {t.at && <p className="mt-0.5 font-mono text-[10px] text-slate-600">{t.at}</p>}
        </li>
      ))}
    </ul>
  );
}

// ---------- Empty / loading / error ----------
export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {body && <p className="mt-1 text-xs text-slate-500">{body}</p>}
    </div>
  );
}

// ---------- Labeled field ----------
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1 text-xs text-slate-400">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-slate-600">{hint}</span>}
    </label>
  );
}

// ---------- Progress bar ----------
export function ProgressBar({ value, tone = "bg-sky-400" }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
