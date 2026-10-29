"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, ShieldCheck, UserCog, UserPlus, Users } from "lucide-react";
import { Badge, Cell, DataTable, EmptyState, Field, PageHeader, Row, Section, Stat, Timeline, statusTone } from "@/components/ui";

type AdminUser = { id: string; email: string; name: string; role: string; districtId?: string; status?: string; phone?: string };
type UsersResp = { ok?: boolean; data?: AdminUser[]; error?: string };
type AuditEntry = { at?: string; actor?: string; action?: string; detail?: string };
type AuditResp = { ok?: boolean; data?: AuditEntry[]; error?: string };
type SummaryResp = { ok?: boolean; data?: Record<string, unknown>; error?: string };

const ROLES = ["dispatcher", "driver", "emt", "hospital_coordinator", "citizen", "super_admin", "district_admin"];

const OPS_LINKS: [string, string, string][] = [["/dispatch", "Dispatch command", "live queue + map"], ["/fleet", "Fleet", "units + readiness"], ["/analytics", "Analytics", "metrics + CSV"], ["/simulation", "Digital twin", "scenarios"]];

function errText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as { error?: unknown; message?: unknown };
    if (typeof o.error === "string") return o.error;
    if (typeof o.message === "string") return o.message;
  }
  return "request failed";
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [listMsg, setListMsg] = useState("Loading users…");
  const [saving, setSaving] = useState<Record<string, string>>({});
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "dispatcher", districtId: "", phone: "" });
  const [formMsg, setFormMsg] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditMsg, setAuditMsg] = useState("Loading audit…");

  const loadUsers = useCallback(async () => {
    setListMsg("Loading users…");
    try {
      const r = await fetch("/api/admin/users");
      const j = (await r.json().catch(() => null)) as UsersResp | null;
      if (!r.ok || !j?.ok) throw new Error(errText(j) || `HTTP ${r.status}`);
      const list = Array.isArray(j?.data) ? j.data as AdminUser[] : [];
      setUsers(list);
      setListMsg(list.length ? "" : "No users found.");
    } catch (e) {
      setListMsg(`Could not load users: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/analytics/summary");
        const j = (await r.json().catch(() => null)) as SummaryResp | null;
        if (r.ok && j?.ok) setSummary(j.data ?? null);
      } catch { /* tolerate */ }
    })();
    (async () => {
      try {
        const r = await fetch("/api/analytics/audit");
        const j = (await r.json().catch(() => null)) as AuditResp | null;
        if (!r.ok || !j?.ok) throw new Error(errText(j) || `HTTP ${r.status}`);
        setAudit((j?.data ?? []).slice(-20).reverse());
        setAuditMsg((j?.data ?? []).length ? "" : "No audit entries yet.");
      } catch (e) {
        setAuditMsg(`Could not load audit: ${e instanceof Error ? e.message : "unknown error"}`);
      }
    })();
  }, []);

  const totals = summary?.totals as Record<string, number> | undefined;
  const active = users.filter((u) => (u.status ?? "active") === "active").length;
  const suspended = users.length - active;

  async function patchUser(u: AdminUser, body: Record<string, string>) {
    setSaving((s) => ({ ...s, [u.id]: "Saving…" }));
    setRowErr((s) => ({ ...s, [u.id]: "" }));
    try {
      const r = await fetch(`/api/admin/users/${encodeURIComponent(u.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!r.ok || (j && j.ok === false)) throw new Error(errText(j) || `HTTP ${r.status}`);
      await loadUsers();
      setSaving((s) => ({ ...s, [u.id]: "Saved" }));
    } catch (e) {
      setRowErr((s) => ({ ...s, [u.id]: e instanceof Error ? e.message : "update failed" }));
      setSaving((s) => ({ ...s, [u.id]: "" }));
    }
  }
  function toggleStatus(u: AdminUser) {
    const suspending = (u.status ?? "active") === "active";
    if (suspending && !window.confirm(`Suspend ${u.email}? They will not be able to sign in.`)) return;
    void patchUser(u, { status: suspending ? "suspended" : "active" });
  }
  async function createUser(e: React.FormEvent) {
    e.preventDefault(); setFormBusy(true); setFormMsg("");
    try {
      const body: Record<string, string> = { email: form.email.trim(), name: form.name.trim(), password: form.password, role: form.role, districtId: form.districtId.trim() };
      if (form.phone.trim()) body["phone"] = form.phone.trim();
      const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!r.ok || (j && j.ok === false)) throw new Error(errText(j) || `HTTP ${r.status}`);
      setFormMsg(`Created ${body["email"] ?? ""}.`);
      setForm({ email: "", name: "", password: "", role: "dispatcher", districtId: form.districtId, phone: "" });
      await loadUsers();
    } catch (err) {
      setFormMsg(`Create failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally { setFormBusy(false); }
  }
  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  return (
    <main className="space-y-4">
      <PageHeader eyebrow="System administration" title="Admin console" sub="Accounts, access and the audit trail. Suspensions take effect on next sign-in; every change is logged." live
        actions={<Badge tone="neutral">super_admin view</Badge>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Accounts" value={String(users.length)} sub={`${active} active · ${suspended} suspended`} tone="info" />
        <Stat icon={UserCog} label="Roles in use" value={String(new Set(users.map((u) => u.role)).size)} sub={[...new Set(users.map((u) => u.role))].slice(0, 3).join(", ")} tone="neutral" />
        <Stat icon={ShieldCheck} label="Districts" value={String(new Set(users.map((u) => u.districtId ?? "—")).size)} sub="scoped access enforced" tone="ok" />
        <Stat icon={Activity} label="Sim incidents" value={String(totals?.incidents ?? "—")} sub={`active ${totals?.active ?? "—"}`} tone="urgent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="User accounts" sub="Suspend to revoke access instantly; role changes apply on next sign-in." wide
            actions={<span className="text-xs text-slate-500">{users.length} total</span>}>
            {listMsg && <EmptyState title={listMsg} />}
            {!listMsg && (
              <DataTable head={["User", "Role", "District", "Status", "Actions"]} minWidth={680}>
                {users.map((u) => (
                  <Row key={u.id}>
                    <Cell strong><div>{u.name}</div><div className="font-mono text-[11px] font-normal text-slate-500">{u.email}</div></Cell>
                    <Cell>
                      <select className="input w-auto py-1.5 text-xs" value={u.role} disabled={!!saving[u.id] && saving[u.id] === "Saving…"} onChange={(e) => void patchUser(u, { role: e.target.value })} aria-label={`Role for ${u.email}`}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </Cell>
                    <Cell muted>{u.districtId ?? "—"}</Cell>
                    <Cell><Badge tone={statusTone(u.status ?? "active")}>{u.status ?? "active"}</Badge></Cell>
                    <Cell>
                      <div className="flex items-center gap-2">
                        <button type="button" className="btn-ghost px-2.5 py-1 text-xs" disabled={!!saving[u.id] && saving[u.id] === "Saving…"} onClick={() => toggleStatus(u)}>
                          {(u.status ?? "active") === "active" ? "Suspend" : "Reactivate"}
                        </button>
                        {saving[u.id] && <span className="text-[11px] text-slate-400">{saving[u.id]}</span>}
                        {rowErr[u.id] && <span className="text-[11px] text-red-400">{rowErr[u.id]}</span>}
                      </div>
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Section>

          <Section title="Recent audit" sub="Newest first. Suspension, role and dispatch decisions all land here.">
            {auditMsg ? <EmptyState title={auditMsg} /> : (
              <div className="max-h-96 overflow-auto pr-1">
                <Timeline items={audit.map((a) => ({ at: a.at, title: `${a.actor ?? "?"} · ${a.action ?? "?"}`, detail: a.detail }))} />
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Create account" sub="Password minimum 8 characters.">
            <form onSubmit={createUser} className="grid gap-2">
              <Field label="Full name"><input className="input mt-1" value={form.name} onChange={(e) => set("name", e.target.value)} required /></Field>
              <Field label="Email"><input className="input mt-1" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></Field>
              <Field label="Password"><input className="input mt-1" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Role"><select className="input mt-1" value={form.role} onChange={(e) => set("role", e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
                <Field label="District"><input className="input mt-1" value={form.districtId} onChange={(e) => set("districtId", e.target.value)} required placeholder="chennai-central" /></Field>
              </div>
              <Field label="Phone (optional)"><input className="input mt-1" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <button className="btn-primary w-full" disabled={formBusy}><UserPlus size={15} /> {formBusy ? "Creating…" : "Create account"}</button>
              {formMsg && <p className="text-xs text-slate-300">{formMsg}</p>}
            </form>
          </Section>

          <Section title="Operations" sub="Jump to the live consoles.">
            <div className="grid gap-2">
              {OPS_LINKS.map(([href, label, sub]) => (
                <Link key={href} href={href} className="btn-ghost justify-start"><span className="text-left"><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-slate-500">{sub}</span></span></Link>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
