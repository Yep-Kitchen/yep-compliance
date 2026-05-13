"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Ingredient, IngredientLot } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface Supplier { id: string; name: string }
type IngredientWithLots = Ingredient & { lots: IngredientLot[]; supplier?: Supplier };

export default function StockPage() {
  const [ingredients, setIngredients] = useState<IngredientWithLots[]>([]);
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<Record<string, boolean>>({});

  // Edit panel
  const [editing, setEditing]         = useState<IngredientWithLots | null>(null);
  const [editPrice, setEditPrice]     = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [saving, setSaving]           = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [lotsRes, ingsRes, supRes] = await Promise.all([
      supabase.from("ingredient_lots").select("*, ingredient:ingredients(*)").order("julian_code"),
      supabase.from("ingredients").select("*").order("name"),
      supabase.from("suppliers").select("id, name").eq("type", "raw_material").order("name"),
    ]);

    const sups = (supRes.data ?? []) as Supplier[];
    setSuppliers(sups);

    if (ingsRes.data && lotsRes.data) {
      const supById = Object.fromEntries(sups.map(s => [s.id, s]));
      const lotsByIng: Record<string, IngredientLot[]> = {};
      for (const lot of (lotsRes.data as (IngredientLot & { ingredient: Ingredient })[]))
        (lotsByIng[lot.ingredient_id] ??= []).push(lot);

      setIngredients(
        (ingsRes.data as Ingredient[]).map(ing => ({
          ...ing,
          lots: lotsByIng[ing.id] ?? [],
          supplier: ing.supplier_id ? supById[ing.supplier_id] : undefined,
        }))
      );
    }
    setLoading(false);
  }

  function openEdit(ing: IngredientWithLots) {
    setEditing(ing);
    setEditPrice(ing.price_per_kg != null ? String(ing.price_per_kg) : "");
    setEditSupplier(ing.supplier_id ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    await supabase
      .from("ingredients")
      .update({
        price_per_kg: editPrice ? parseFloat(editPrice) : null,
        supplier_id: editSupplier || null,
      })
      .eq("id", editing.id);
    setSaving(false);
    setEditing(null);
    await load();
  }

  const totalRemainingG = ingredients.reduce((s, i) => s + i.lots.reduce((a, l) => a + l.quantity_remaining_g, 0), 0);

  const totalValue = ingredients.reduce((s, ing) => {
    if (!ing.price_per_kg) return s;
    const kg = ing.lots.reduce((a, l) => a + l.quantity_remaining_g, 0) / 1000;
    return s + kg * ing.price_per_kg;
  }, 0);

  const outOfStock = ingredients.filter(ing =>
    ing.lots.length > 0 && ing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0) === 0
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-ghost text-xs px-2">← Dashboard</Link>
            <h1 className="text-base font-semibold text-gray-900">Stock Levels</h1>
          </div>
          <Link href="/admin/goods-in" className="btn-primary text-xs">Log Delivery</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ingredients</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{ingredients.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total stock</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{(totalRemainingG / 1000).toFixed(1)} kg</p>
          </div>
          <div className="card p-4 border-green-200 bg-green-50">
            <p className="text-xs text-green-700 font-medium uppercase tracking-wide">Stock value</p>
            <p className="mt-1 text-2xl font-bold text-green-900">
              {totalValue > 0 ? `£${totalValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
            </p>
          </div>
          <div className={`card p-4 ${outOfStock > 0 ? "border-red-200 bg-red-50" : ""}`}>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Out of stock</p>
            <p className={`mt-1 text-2xl font-bold ${outOfStock > 0 ? "text-red-700" : "text-gray-900"}`}>{outOfStock}</p>
          </div>
        </div>

        {/* Ingredient table */}
        {loading ? (
          <div className="card p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">All ingredients</h2>
              <span className="text-xs text-gray-400">Click an ingredient to set price &amp; supplier · click row arrow to see lots</span>
            </div>
            <div className="divide-y divide-gray-100">
              {ingredients.map(ing => {
                const totalRemaining = ing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0);
                const openLots = ing.lots.filter(l => l.quantity_remaining_g > 0);
                const isOpen = expanded[ing.id];
                const hasStock = totalRemaining > 0;
                const noLots = ing.lots.length === 0;
                const value = ing.price_per_kg != null ? (totalRemaining / 1000) * ing.price_per_kg : null;

                return (
                  <div key={ing.id}>
                    <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition">
                      {/* Ingredient name — click to edit */}
                      <button
                        onClick={() => openEdit(ing)}
                        className="flex-1 min-w-0 text-left group"
                      >
                        <p className="text-sm font-medium text-gray-900 group-hover:text-brand transition-colors">
                          {ing.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {ing.supplier?.name ?? <span className="text-amber-500">No supplier set</span>}
                          {ing.price_per_kg != null
                            ? ` · £${ing.price_per_kg.toFixed(2)}/kg`
                            : <span className="text-amber-500"> · No price set</span>
                          }
                        </p>
                      </button>

                      {/* Stock + value */}
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${!hasStock && !noLots ? "text-red-600" : "text-gray-900"}`}>
                          {noLots ? "—" : `${totalRemaining.toLocaleString()}g`}
                        </p>
                        <p className="text-xs text-gray-400">
                          {value != null
                            ? `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : noLots ? "" : `${(totalRemaining / 1000).toFixed(2)} kg`
                          }
                        </p>
                      </div>

                      {/* Expand lots arrow */}
                      {!noLots && (
                        <button
                          onClick={() => setExpanded(p => ({ ...p, [ing.id]: !p[ing.id] }))}
                          className="p-1 rounded hover:bg-gray-200 transition shrink-0"
                          title="Show lots"
                        >
                          <svg className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {isOpen && ing.lots.length > 0 && (
                      <div className="bg-gray-50 border-t border-gray-100 px-4 py-2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left py-1 font-medium">Julian code</th>
                              <th className="text-right py-1 font-medium">Received (g)</th>
                              <th className="text-right py-1 font-medium">Remaining (g)</th>
                              <th className="text-left py-1 font-medium pl-4">Date in</th>
                              <th className="text-left py-1 font-medium">Supplier</th>
                              <th className="text-left py-1 font-medium">Best before</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {ing.lots.map(lot => (
                              <tr key={lot.id} className={lot.quantity_remaining_g === 0 ? "opacity-40" : ""}>
                                <td className="py-1.5 font-mono font-semibold text-gray-900">{lot.julian_code}</td>
                                <td className="py-1.5 text-right tabular-nums text-gray-600">{lot.quantity_received_g.toLocaleString()}</td>
                                <td className="py-1.5 text-right tabular-nums font-semibold text-gray-900">{lot.quantity_remaining_g.toLocaleString()}</td>
                                <td className="py-1.5 pl-4 text-gray-500">{formatDate(lot.received_date)}</td>
                                <td className="py-1.5 text-gray-500">{lot.supplier ?? "—"}</td>
                                <td className="py-1.5 text-gray-500">{lot.best_before_date ? formatDate(lot.best_before_date) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Edit panel */}
      {editing && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setEditing(null)} />
          <div className="w-full max-w-sm bg-white shadow-xl flex flex-col">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{editing.name}</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>

            <div className="flex-1 px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Supplier</label>
                <select
                  className="input w-full"
                  value={editSupplier}
                  onChange={e => setEditSupplier(e.target.value)}
                >
                  <option value="">— None —</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Price per kg (£)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input w-full pl-7"
                    placeholder="0.00"
                    value={editPrice}
                    onChange={e => setEditPrice(e.target.value)}
                  />
                </div>
                {editPrice && editing.lots.length > 0 && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Stock value:{" "}
                    <span className="font-semibold text-green-700">
                      £{((editing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0) / 1000) * parseFloat(editPrice)).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
              <button onClick={() => setEditing(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
