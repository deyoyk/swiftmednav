"use client";
import { useState } from "react";
export default function Simple({ title, body }: { title?: string; body?: string }) {
  return <main className="card p-6"><h1 className="font-semibold">{title ?? "Page"}</h1><p className="mt-2 text-sm text-slate-400">{body ?? "Functional screen wired in Phase 4. All actions log to audit + SSE. Simulated data only."}</p></main>;
}
