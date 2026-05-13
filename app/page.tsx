"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Checklist, Submission } from "@/lib/types";
import { frequencyLabel, frequencyBadgeColor, formatDateTime } from "@/lib/utils";

export default function Dashboard() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<(Submission & { checklist: Checklist })[]>([]);
  const [pendingSignOff, setPendingSignOff] = useState<(Submission & { checklist: Checklist })[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      const [clRes, subRes] = await Promise.all([
        supabase.from("checklists").select("*").eq("active", true).order("name"),
        supabase
          .from("submissions")
          .select("*, checklist:checklists(*)")
          .order("submitted_at", { ascending: false })
          .limit(50),
      ]);
      if (clRes.data) setChecklists(clRes.data as Checklist[]);
      if (subRes.data) {
        const all = subRes.data as (Submission & { checklist: Checklist })[];
        setRecentSubmissions(all.slice(0, 10));
        setPendingSignOff(all.filter(s => !s.signed_off_at).slice(0, 20));
      }
      setLoading(false);
    }
    load();
  }, []);

  const todayCount = recentSubmissions.filter(
    s => new Date(s.submitted_at).toDateString() === new Date().toDateString()
  ).length;

  // Group checklists by category
  const grouped = groupByCategory(checklists);
  const categoryOrder = Object.keys(grouped).sort((a, b) =>
    a === "Uncategorised" ? 1 : b === "Uncategorised" ? -1 : a.localeCompare(b)
  );

  function toggleCategory(cat: string) {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Yep Kitchen" className="h-10 w-auto" />
            <p className="text-xs text-gray-500 hidden sm:block">Compliance Portal</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="btn-secondary text-xs">All Submissions</Link>
            <Link href="/print-qr" className="btn-secondary text-xs">Print QR Codes</Link>
            <Link href="/admin/checklists" className="btn-secondary text-xs">Edit Checklists</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Checklists" value={checklists.length} loading={loading} />
          <StatCard label="Today's submissions" value={todayCount} loading={loading} />
          <StatCard label="Pending sign-off" value={pendingSignOff.length} loading={loading} accent={pendingSignOff.length > 0} />
          <StatCard label="This week" value={recentSubmissions.filter(s => isThisWeek(s.submitted_at)).length} loading={loading} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Checklists grouped by category */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Checklists</h2>
              <span className="text-sm text-gray-500">{checklists.length} active</span>
            </div>

            {loading ? (
              <div className="card p-6 text-center text-sm text-gray-500">Loading…</div>
            ) : categoryOrder.length === 0 ? (
              <div className="card p-6 text-center text-sm text-gray-500">No checklists yet.</div>
            ) : (
              categoryOrder.map(cat => {
                const items = grouped[cat];
                const isOpen = !collapsed[cat];
                return (
                  <div key={cat} className="card overflow-hidden">
                    {/* Category header */}
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="flex w-full items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronIcon open={isOpen} />
                        <span className="font-semibold text-gray-800 text-sm">{cat}</span>
                        <span className="badge bg-gray-200 text-gray-500">{items.length}</span>
                      </div>
                    </button>

                    {/* Checklist rows */}
                    {isOpen && (
                      <div className="divide-y divide-gray-100">
                        {items.map(cl => (
                          <ChecklistRow key={cl.id} checklist={cl} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pending sign-off */}
            <div>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Awaiting Sign-Off</h2>
              {loading ? (
                <div className="card p-4 text-center text-sm text-gray-500">Loading…</div>
              ) : pendingSignOff.length === 0 ? (
                <div className="card p-4 text-center text-sm text-green-600 font-medium">All caught up ✓</div>
              ) : (
                <div className="space-y-2">
                  {pendingSignOff.slice(0, 8).map(s => (
                    <Link key={s.id} href={`/submission/${s.id}`}
                      className="card flex items-start gap-3 p-3 hover:border-brand/40 hover:shadow-md transition"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.checklist?.name}</p>
                        <p className="text-xs text-gray-500">{s.submitted_by} · {formatDateTime(s.submitted_at)}</p>
                      </div>
                      <span className="badge bg-amber-100 text-amber-700 shrink-0">Review</span>
                    </Link>
                  ))}
                  {pendingSignOff.length > 8 && (
                    <p className="text-xs text-center text-gray-500 pt-1">+{pendingSignOff.length - 8} more</p>
                  )}
                </div>
              )}
            </div>

            {/* Recent submissions */}
            <div>
              <h2 className="mb-3 text-lg font-semibold text-gray-900">Recent Submissions</h2>
              {loading ? (
                <div className="card p-4 text-center text-sm text-gray-500">Loading…</div>
              ) : recentSubmissions.length === 0 ? (
                <div className="card p-4 text-center text-sm text-gray-500">No submissions yet.</div>
              ) : (
                <div className="space-y-2">
                  {recentSubmissions.map(s => (
                    <Link key={s.id} href={`/submission/${s.id}`}
                      className="card flex items-start gap-3 p-3 hover:border-brand/40 hover:shadow-md transition"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.checklist?.name}</p>
                        <p className="text-xs text-gray-500">{s.submitted_by} · {formatDateTime(s.submitted_at)}</p>
                      </div>
                      {s.signed_off_at
                        ? <span className="badge bg-green-100 text-green-700 shrink-0">Signed off</span>
                        : <span className="badge bg-amber-100 text-amber-700 shrink-0">Pending</span>
                      }
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function groupByCategory(checklists: Checklist[]): Record<string, Checklist[]> {
  return checklists.reduce<Record<string, Checklist[]>>((acc, cl) => {
    const cat = cl.category?.trim() || "Uncategorised";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cl);
    return acc;
  }, {});
}

function isThisWeek(iso: string) {
  const d = new Date(iso);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return d >= weekAgo && d <= new Date();
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, loading, accent }: { label: string; value: number; loading: boolean; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? "border-amber-300 bg-amber-50" : ""}`}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      {loading
        ? <div className="mt-1 h-7 w-12 animate-pulse rounded bg-gray-200" />
        : <p className={`mt-1 text-2xl font-bold ${accent ? "text-amber-700" : "text-gray-900"}`}>{value}</p>
      }
    </div>
  );
}

function ChecklistRow({ checklist }: { checklist: Checklist }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{checklist.name}</p>
        <span className={`badge mt-0.5 ${frequencyBadgeColor(checklist.frequency as never)}`}>
          {frequencyLabel(checklist.frequency as never)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href={`/checklist/${checklist.id}`} className="btn-ghost text-xs">Open form</Link>
        <Link href={`/print-qr?id=${checklist.id}`} className="btn-ghost text-xs">QR</Link>
      </div>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`}
      viewBox="0 0 16 16" fill="currentColor"
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}
