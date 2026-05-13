"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Checklist, Submission, Ingredient, IngredientLot, Dispatch } from "@/lib/types";
import { frequencyLabel, frequencyBadgeColor, formatDateTime } from "@/lib/utils";

const SKUS = [
  "Garlic Chilli Oil",
  "Garlic Chilli Oil with Beef",
  "Sichuan Chilli Crisp",
  "Sichuan Chilli Crisp Double Heat",
  "Hunan Salted Chillies",
];

interface SkuStock {
  name: string;
  produced: number;
  dispatched: number;
  inStock: number;
}

type IngredientWithLots = Ingredient & { lots: IngredientLot[] };

export default function Dashboard() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<(Submission & { checklist: Checklist })[]>([]);
  const [pendingSignOff, setPendingSignOff] = useState<(Submission & { checklist: Checklist })[]>([]);
  const [openDrafts, setOpenDrafts] = useState<Array<{ id: string; checklist_id: string; started_by: string; last_saved_at: string; checklist?: Checklist }>>([]);
  const [ingredients, setIngredients] = useState<IngredientWithLots[]>([]);
  const [skuStock, setSkuStock] = useState<SkuStock[]>([]);
  const [loading, setLoading] = useState(true);
  // expanded = true means open; default closed
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [clRes, subRes, draftRes, ingRes, lotRes, dispRes, batchSubRes] = await Promise.all([
      supabase.from("checklists").select("*").eq("active", true).order("name"),
      supabase
        .from("submissions")
        .select("*, checklist:checklists(*)")
        .order("submitted_at", { ascending: false })
        .limit(50),
      supabase
        .from("batch_drafts")
        .select("*, checklist:checklists(name, category)")
        .order("last_saved_at", { ascending: false })
        .limit(10),
      supabase.from("ingredients").select("*").order("name"),
      supabase.from("ingredient_lots").select("*").order("julian_code"),
      supabase.from("dispatches").select("product, total_units"),
      supabase
        .from("submissions")
        .select("id, checklist:checklists(name, category), answers(value, question:questions(type, label))")
        .eq("checklists.category", "Production"),
    ]);

    if (clRes.data) setChecklists(clRes.data as Checklist[]);

    if (subRes.data) {
      const all = subRes.data as (Submission & { checklist: Checklist })[];
      setRecentSubmissions(all.filter(s => s.checklist).slice(0, 10));
      setPendingSignOff(all.filter(s => s.checklist && !s.signed_off_at).slice(0, 20));
    }

    if (draftRes.data) setOpenDrafts(draftRes.data as never);

    if (ingRes.data && lotRes.data) {
      const lots = lotRes.data as IngredientLot[];
      const byIng: Record<string, IngredientLot[]> = {};
      for (const l of lots) {
        if (!byIng[l.ingredient_id]) byIng[l.ingredient_id] = [];
        byIng[l.ingredient_id].push(l);
      }
      setIngredients(
        (ingRes.data as Ingredient[]).map(ing => ({ ...ing, lots: byIng[ing.id] ?? [] }))
      );
    }

    if (batchSubRes.data && dispRes.data) {
      const dispatchedByProduct: Record<string, number> = {};
      for (const d of (dispRes.data as { product: string; total_units: number }[])) {
        dispatchedByProduct[d.product] = (dispatchedByProduct[d.product] ?? 0) + d.total_units;
      }

      const producedByProduct: Record<string, number> = {};
      for (const sub of (batchSubRes.data as never as Array<{
        checklist: { name: string; category: string } | null;
        answers: Array<{ value: string | null; question: { type: string; label: string } | null }>;
      }>)) {
        if (sub.checklist?.category !== "Production") continue;
        const skuName = sub.checklist.name.replace(" — Production Record", "");
        for (const ans of (sub.answers ?? [])) {
          if (ans.question?.type !== "packing_runs" || !ans.value) continue;
          try {
            const rows = JSON.parse(ans.value);
            if (Array.isArray(rows)) {
              for (const row of rows) {
                const jars = Number(row.jars_used) || 0;
                producedByProduct[skuName] = (producedByProduct[skuName] ?? 0) + jars;
              }
            }
          } catch { /* ignore */ }
        }
      }

      setSkuStock(
        SKUS.map(name => {
          const produced = producedByProduct[name] ?? 0;
          const dispatched = dispatchedByProduct[name] ?? 0;
          return { name, produced, dispatched, inStock: Math.max(0, produced - dispatched) };
        })
      );
    }

    setLoading(false);
  }

  const todayCount = recentSubmissions.filter(
    s => new Date(s.submitted_at).toDateString() === new Date().toDateString()
  ).length;

  const grouped = groupByCategory(checklists);
  const categoryOrder = Object.keys(grouped).sort((a, b) =>
    a === "Uncategorised" ? 1 : b === "Uncategorised" ? -1 : a.localeCompare(b)
  );

  function toggleCategory(cat: string) {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));
  }

  const totalRawMaterialsKg = ingredients.reduce(
    (sum, ing) => sum + ing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0), 0
  ) / 1000;

  const totalFinishedUnits = skuStock.reduce((s, sku) => s + sku.inStock, 0);
  const outOfStockRaw = ingredients.filter(ing => {
    const total = ing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0);
    return ing.lots.length > 0 && total === 0;
  }).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Yep Kitchen" className="h-14 w-auto" />
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-gray-700">Compliance Portal</p>
              <p className="text-xs text-gray-400">Yep Kitchen</p>
            </div>
          </div>
          <nav className="flex items-center gap-2 flex-wrap justify-end">
            <NavLink href="/dashboard">All Submissions</NavLink>
            <NavLink href="/admin/stock">Stock</NavLink>
            <NavLink href="/admin/goods-in">Goods In</NavLink>
            <NavLink href="/admin/goods-out">Goods Out</NavLink>
            <NavLink href="/admin/traceability">Traceability</NavLink>
            <NavLink href="/print-qr">Print QR</NavLink>
            <NavLink href="/admin/checklists">Checklists</NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-8">

        {/* ── Key stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Checklists" value={checklists.length} loading={loading} color="gray" />
          <StatCard label="Today's submissions" value={todayCount} loading={loading} color="blue" />
          <StatCard label="Pending sign-off" value={pendingSignOff.length} loading={loading} color={pendingSignOff.length > 0 ? "amber" : "gray"} />
          <StatCard label="This week" value={recentSubmissions.filter(s => isThisWeek(s.submitted_at)).length} loading={loading} color="green" />
        </div>

        {/* ── Inventory overview ────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Inventory</h2>
          <div className="grid gap-6 lg:grid-cols-2">

            {/* Finished goods */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Finished goods</h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{totalFinishedUnits} units total</span>
                  <Link href="/admin/goods-out" className="btn-ghost text-xs py-1 px-2">Log dispatch →</Link>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {loading ? (
                  <div className="p-4 text-center text-sm text-gray-500">Loading…</div>
                ) : skuStock.map(sku => (
                  <div key={sku.name} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{sku.name}</p>
                      <p className="text-xs text-gray-400">
                        {sku.produced} produced · {sku.dispatched} dispatched
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-bold tabular-nums ${sku.inStock === 0 ? "text-gray-300" : "text-gray-900"}`}>
                        {sku.inStock}
                      </p>
                      <p className="text-xs text-gray-400">units</p>
                    </div>
                    <StockBar value={sku.inStock} max={Math.max(...skuStock.map(s => s.inStock), 1)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Raw materials */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Raw materials</h3>
                <div className="flex items-center gap-3">
                  {outOfStockRaw > 0 && (
                    <span className="badge bg-red-100 text-red-700">{outOfStockRaw} out of stock</span>
                  )}
                  <span className="text-xs text-gray-500">{totalRawMaterialsKg.toFixed(1)} kg total</span>
                  <Link href="/admin/goods-in" className="btn-ghost text-xs py-1 px-2">Goods in →</Link>
                </div>
              </div>
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-sm text-gray-500">Loading…</div>
                ) : ingredients.map(ing => {
                  const total = ing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0);
                  const noLots = ing.lots.length === 0;
                  const hasStock = total > 0;
                  return (
                    <div key={ing.id} className={`flex items-center gap-3 px-4 py-2.5 ${!hasStock && !noLots ? "bg-red-50" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{ing.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {noLots ? (
                          <span className="text-xs text-gray-300">No deliveries</span>
                        ) : (
                          <>
                            <p className={`text-sm font-bold tabular-nums ${!hasStock ? "text-red-600" : "text-gray-900"}`}>
                              {total === 0 ? "OUT" : `${total.toLocaleString()}g`}
                            </p>
                            <p className="text-xs text-gray-400">{(total / 1000).toFixed(2)} kg</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                <Link href="/admin/stock" className="text-xs text-brand hover:underline">View full stock detail →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Checklists + sidebar ──────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
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
                const isOpen = !!expanded[cat];
                return (
                  <div key={cat} className="card overflow-hidden">
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
            {openDrafts.length > 0 && (
              <div>
                <h2 className="mb-3 text-lg font-semibold text-gray-900">In-Progress Batches</h2>
                <div className="space-y-2">
                  {openDrafts.map(d => {
                    const savedAt = new Date(d.last_saved_at);
                    const mins = Math.round((Date.now() - savedAt.getTime()) / 60000);
                    const timeLabel = mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
                    return (
                      <Link key={d.id} href={`/checklist/${d.checklist_id}`}
                        className="card flex items-start gap-3 p-3 hover:border-brand/40 hover:shadow-md transition border-amber-200 bg-amber-50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{(d.checklist as Checklist | undefined)?.name ?? "Batch record"}</p>
                          <p className="text-xs text-gray-500">{d.started_by} · saved {timeLabel}</p>
                        </div>
                        <span className="badge bg-amber-200 text-amber-800 shrink-0">In progress</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 hover:border-gray-400 active:scale-95"
    >
      {children}
    </Link>
  );
}

type StatColor = "gray" | "blue" | "amber" | "green";

const statColorMap: Record<StatColor, { border: string; bg: string; label: string; value: string; icon: string }> = {
  gray:  { border: "border-gray-200",  bg: "bg-white",       label: "text-gray-500",  value: "text-gray-900",  icon: "bg-gray-100" },
  blue:  { border: "border-blue-200",  bg: "bg-blue-50",     label: "text-blue-600",  value: "text-blue-900",  icon: "bg-blue-100" },
  amber: { border: "border-amber-300", bg: "bg-amber-50",    label: "text-amber-700", value: "text-amber-900", icon: "bg-amber-100" },
  green: { border: "border-green-200", bg: "bg-green-50",    label: "text-green-700", value: "text-green-900", icon: "bg-green-100" },
};

function StatCard({ label, value, loading, color = "gray" }: { label: string; value: number; loading: boolean; color?: StatColor }) {
  const c = statColorMap[color];
  return (
    <div className={`rounded-xl border-2 ${c.border} ${c.bg} p-4 shadow-sm`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${c.label}`}>{label}</p>
      {loading
        ? <div className="mt-2 h-8 w-14 animate-pulse rounded bg-gray-200" />
        : <p className={`mt-1 text-3xl font-bold ${c.value}`}>{value}</p>
      }
    </div>
  );
}

function StockBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-16 shrink-0">
      <div className="h-2 rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full transition-all ${pct === 0 ? "bg-gray-200" : "bg-brand"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
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
