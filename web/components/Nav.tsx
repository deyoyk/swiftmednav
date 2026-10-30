"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard } from "lucide-react";

type SessionData = { sub: string; role: string; districtId?: string; name?: string };

const ROLE_LINKS: Record<string, { href: string; label: string }[]> = {
  dispatcher: [
    { href: "/dispatch", label: "Dispatch" },
    { href: "/algorithms", label: "Algorithms" },
    { href: "/fleet", label: "Fleet" },
    { href: "/simulation", label: "Simulation" },
    { href: "/analytics", label: "Analytics" },
    { href: "/explain", label: "Explain" },
  ],
  driver: [{ href: "/driver", label: "Driver" }],
  emt: [{ href: "/emt", label: "EMT" }],
  hospital_coordinator: [{ href: "/hospital", label: "Hospital" }],
  citizen: [{ href: "/request", label: "Request" }],
  super_admin: [
    { href: "/admin", label: "Admin" },
    { href: "/dispatch", label: "Dispatch" },
    { href: "/algorithms", label: "Algorithms" },
    { href: "/fleet", label: "Fleet" },
    { href: "/simulation", label: "Simulation" },
    { href: "/analytics", label: "Analytics" },
    { href: "/explain", label: "Explain" },
  ],
  district_admin: [
    { href: "/admin", label: "Admin" },
    { href: "/dispatch", label: "Dispatch" },
    { href: "/algorithms", label: "Algorithms" },
    { href: "/fleet", label: "Fleet" },
    { href: "/simulation", label: "Simulation" },
    { href: "/analytics", label: "Analytics" },
    { href: "/explain", label: "Explain" },
  ],
};

export default function Nav() {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/session");
        if (!cancelled) {
          if (r.ok) {
            const j = (await r.json().catch(() => null)) as { ok?: boolean; data?: SessionData } | null;
            setSession(j?.data ?? null);
          } else {
            setSession(null);
          }
        }
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (pathname === "/login" || pathname === "/request") return null;

  const links = session ? (ROLE_LINKS[session.role] ?? []) : [];

  async function signOut() {
    try {
      await fetch("/api/auth/session", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/15 text-red-300"><LayoutDashboard size={14} /></span>
          SwiftMedNav
        </Link>
        {session ? (
          <>
            <nav className="flex flex-1 flex-wrap items-center gap-1.5">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="btn-ghost px-3 py-1.5 text-xs">
                  {l.label}
                </Link>
              ))}
            </nav>
            <span className="badge border-white/15 bg-white/5 text-slate-200">{session.role}</span>
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={signOut}>
              Sign out
            </button>
          </>
        ) : (
          loaded && (
            <nav className="ml-auto flex items-center gap-1.5">
              <Link href="/" className="btn-ghost px-3 py-1.5 text-xs">
                Home
              </Link>
              <Link href="/login" className="btn-ghost px-3 py-1.5 text-xs">
                Login
              </Link>
            </nav>
          )
        )}
      </div>
    </header>
  );
}
