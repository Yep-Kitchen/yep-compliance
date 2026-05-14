"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Ingredient, IngredientLot } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface Supplier { id: string; name: string }
type IngredientWithLots = Ingredient & { lots: IngredientLot[]; supplier?: Supplier };

function fmtQty(remaining: number, unit: "g" | "units") {
  if (unit === "units") return `${remaining} units`;
  return `${(remaining / 1000).toFixed(2)} kg`;
}

function fmtQtyReceived(qty: number, unit: "g" | "units") {
  if (unit === "units") return `${qty} units`;
  return `${(qty / 1000).toFixed(2)} kg`;
}

const EMPTY_EDITING: IngredientWithLots = {
  id: "", name: "", type: "ingredient", unit: "g",
  price_per_kg: null, supplier_id: null, density_g_per_l: null,
  created_at: "", lots: [],
};

export default function StockPage() {
  const [ingredients, setIngredients] = useState<IngredientWithLots[]>([]);
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<Record<string, boolean>>({});

  // Edit / create panel
  const [editing, setEditing]         = useState<IngredientWithLots | null>(null);
  const [editName, setEditName]       = useState("");
  const [editType, setEditType]       = useState<"ingredient" | "packaging">("ingredient");
  const [editUnit, setEditUnit]       = useState<"g" | "units">("g");
  const [editPrice, setEditPrice]     = useState("");
  const [editSupplier, setEditSupplier] = useState("");
  const [editDensity, setEditDensity] = useState("");
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isNew = editing?.id === "";

  useEffect(() => { load(); }, []);

  async function load() {
    const [lotsRes, ingsRes, supRes] = await Promise.all([
      supabase.from("ingredient_lots").select("*, ingredient:ingredients(*)").order("julian_code"),
      supabase.from("ingredients").select("*").order("name"),
      supabase.from("suppliers").select("id, name").order("name"),
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
    setEditName(ing.name);
    setEditType(ing.type ?? "ingredient");
    setEditUnit(ing.unit ?? "g");
    setEditPrice(ing.price_per_kg != null ? String(ing.price_per_kg) : "");
    setEditSupplier(ing.supplier_id ?? "");
    setEditDensity(ing.density_g_per_l != null ? String(ing.density_g_per_l) : "");
    setSaveError("");
    setDeleteConfirm(false);
  }

  function openCreate(type: "ingredient" | "packaging") {
    setEditing({ ...EMPTY_EDITING, type, unit: type === "packaging" ? "units" : "g" });
    setEditName("");
    setEditType(type);
    setEditUnit(type === "packaging" ? "units" : "g");
    setEditPrice("");
    setEditSupplier("");
    setEditDensity("");
    setSaveError("");
    setDeleteConfirm(false);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editName.trim()) { setSaveError("Name is required"); return; }
    setSaving(true);
    setSaveError("");

    const payload = {
      name: editName.trim(),
      type: editType,
      unit: editUnit,
      price_per_kg: editPrice ? parseFloat(editPrice) : null,
      supplier_id: editSupplier || null,
      density_g_per_l: editDensity ? parseFloat(editDensity) : null,
    };

    const { error } = isNew
      ? await supabase.from("ingredients").insert(payload)
      : await supabase.from("ingredients").update(payload).eq("id", editing.id);

    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setEditing(null);
    await load();
  }

  async function deleteIngredient() {
    if (!editing) return;
    if (editing.lots.length > 0) {
      setSaveError("Cannot delete — this item has delivery records. Remove the lots first.");
      setDeleteConfirm(false);
      return;
    }
    const { error } = await supabase.from("ingredients").delete().eq("id", editing.id);
    if (error) { setSaveError(error.message); return; }
    setEditing(null);
    await load();
  }

  const ingItems = ingredients.filter(i => i.type === "ingredient");
  const pkgItems = ingredients.filter(i => i.type === "packaging");

  const totalRemainingG = ingItems.reduce((s, i) => s + i.lots.reduce((a, l) => a + l.quantity_remaining_g, 0), 0);
  const totalValue = ingredients.reduce((s, ing) => {
    if (!ing.price_per_kg) return s;
    const qty = ing.lots.reduce((a, l) => a + l.quantity_remaining_g, 0);
    const divisor = ing.unit === "units" ? 1 : 1000;
    return s + (qty / divisor) * ing.price_per_kg;
  }, 0);
  const outOfStock = ingredients.filter(ing =>
    ing.lots.length > 0 && ing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0) === 0
  ).length;

  function StockTable({ items, label }: { items: IngredientWithLots[]; label: string }) {
    const isPackaging = label === "Packaging";
    return (
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{label}</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Click a row to edit · expand arrow to see lots</span>
            <button
              onClick={() => openCreate(isPackaging ? "packaging" : "ingredient")}
              className="btn-primary text-xs py-1 px-3"
            >
              + Add
            </button>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">
            No {label.toLowerCase()} yet — click + Add to create one
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Supplier</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {isPackaging ? "Price / unit" : "Price / kg"}
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">In stock</th>
                <th className="w-8 px-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(ing => {
                const totalRemaining = ing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0);
                const isOpen = expanded[ing.id];
                const hasStock = totalRemaining > 0;
                const noLots = ing.lots.length === 0;
                const unit = ing.unit ?? "g";
                const value = ing.price_per_kg != null
                  ? (unit === "units" ? totalRemaining : totalRemaining / 1000) * ing.price_per_kg
                  : null;

                return (
                  <>
                    <tr
                      key={ing.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => openEdit(ing)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{ing.name}</td>
                      <td className="px-4 py-3">
                        {ing.supplier?.name
                          ? <span className="text-gray-600">{ing.supplier.name}</span>
                          : <span className="text-amber-500 text-xs">Not set</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {ing.price_per_kg != null
                          ? <span className="text-gray-600">£{ing.price_per_kg.toFixed(2)}</span>
                          : <span className="text-amber-500 text-xs">Not set</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        {noLots ? (
                          <span className="text-gray-300">—</span>
                        ) : (
                          <div>
                            <p className={`font-semibold tabular-nums ${!hasStock ? "text-red-600" : "text-gray-900"}`}>
                              {fmtQty(totalRemaining, unit)}
                            </p>
                            {value != null && (
                              <p className="text-xs text-green-700 font-medium">
                                £{value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                        {!noLots && (
                          <button
                            onClick={() => setExpanded(p => ({ ...p, [ing.id]: !p[ing.id] }))}
                            className="p-1 rounded hover:bg-gray-200 transition"
                          >
                            <svg className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                              viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>

                    {isOpen && ing.lots.length > 0 && (
                      <tr key={`${ing.id}-lots`}>
                        <td colSpan={5} className="bg-gray-50 border-t border-gray-100 px-4 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left py-1 font-medium">Batch / ref</th>
                                <th className="text-right py-1 font-medium">Received</th>
                                <th className="text-right py-1 font-medium">Remaining</th>
                                <th className="text-left py-1 font-medium pl-4">Date in</th>
                                <th className="text-left py-1 font-medium">Supplier on lot</th>
                                <th className="text-left py-1 font-medium">Best before</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {ing.lots.map(lot => (
                                <tr key={lot.id} className={lot.quantity_remaining_g === 0 ? "opacity-40" : ""}>
                                  <td className="py-1.5 font-mono font-semibold text-gray-900">{lot.julian_code}</td>
                                  <td className="py-1.5 text-right tabular-nums text-gray-600">{fmtQtyReceived(lot.quantity_received_g, unit)}</td>
                                  <td className="py-1.5 text-right tabular-nums font-semibold text-gray-900">{fmtQtyReceived(lot.quantity_remaining_g, unit)}</td>
                                  <td className="py-1.5 pl-4 text-gray-500">{formatDate(lot.received_date)}</td>
                                  <td className="py-1.5 text-gray-500">{lot.supplier ?? "—"}</td>
                                  <td className="py-1.5 text-gray-500">{lot.best_before_date ? formatDate(lot.best_before_date) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }

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
            <p className="mt-1 text-2xl font-bold text-gray-900">{ingItems.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ingredient stock</p>
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

        {loading ? (
          <div className="card p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : (
          <>
            <StockTable items={ingItems} label="Ingredients" />
            <StockTable items={pkgItems} label="Packaging" />
          </>
        )}
      </main>

      {/* Edit / create panel */}
      {editing && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setEditing(null)} />
          <div className="w-full max-w-sm bg-white shadow-xl flex flex-col">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                {isNew ? `New ${editType === "packaging" ? "packaging item" : "ingredient"}` : editing.name}
              </h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {isNew && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder={editType === "packaging" ? "e.g. Glass jar 250ml" : "e.g. Garlic"}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                  />
                </div>
              )}

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
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {editUnit === "units" ? "Price per unit (£)" : "Price per kg (£)"}
                </label>
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
                {editPrice && !isNew && editing.lots.length > 0 && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Stock value:{" "}
                    <span className="font-semibold text-green-700">
                      £{(() => {
                        const qty = editing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0);
                        const divisor = editUnit === "units" ? 1 : 1000;
                        return ((qty / divisor) * parseFloat(editPrice)).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      })()}
                    </span>
                  </p>
                )}
              </div>

              {editType === "ingredient" && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Density (g per litre)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="input w-full"
                    placeholder="e.g. 917 for oil"
                    value={editDensity}
                    onChange={e => setEditDensity(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-400">Set for liquids so Goods In can accept litres</p>
                </div>
              )}
            </div>

            {saveError && (
              <div className="mx-6 mb-2 rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                {saveError}
              </div>
            )}

            <div className="border-t border-gray-200 px-6 pt-3 pb-3">
              {!isNew && (
                deleteConfirm ? (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-red-600 flex-1">Delete {editing.name}?</span>
                    <button onClick={deleteIngredient} className="text-xs text-red-600 font-semibold hover:underline">Yes, delete</button>
                    <button onClick={() => setDeleteConfirm(false)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(true)} className="text-xs text-red-400 hover:text-red-600 mb-3 block">
                    Delete {editType === "packaging" ? "item" : "ingredient"}
                  </button>
                )
              )}
              <div className="flex gap-3">
                <button onClick={() => setEditing(null)} className="btn-ghost flex-1">Cancel</button>
                <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">
                  {saving ? "Saving…" : isNew ? "Create" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
