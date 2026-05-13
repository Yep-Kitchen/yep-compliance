"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Ingredient, IngredientLot } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface DeliveryRow {
  id: string;
  ingredientId: string;
  julianCode: string;
  quantityG: string;
  supplier: string;
  bestBefore: string;
}

function emptyRow(): DeliveryRow {
  return {
    id: crypto.randomUUID(),
    ingredientId: "",
    julianCode: "",
    quantityG: "",
    supplier: "",
    bestBefore: "",
  };
}

export default function GoodsInPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recentLots, setRecentLots] = useState<(IngredientLot & { ingredient: Ingredient })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [rows, setRows] = useState<DeliveryRow[]>([emptyRow()]);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [createdBy, setCreatedBy] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [ingRes, lotRes] = await Promise.all([
      supabase.from("ingredients").select("*").order("name"),
      supabase
        .from("ingredient_lots")
        .select("*, ingredient:ingredients(name)")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (ingRes.data) setIngredients(ingRes.data);
    if (lotRes.data) setRecentLots(lotRes.data as (IngredientLot & { ingredient: Ingredient })[]);
    setLoading(false);
  }

  function updateRow(id: string, field: keyof DeliveryRow, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!createdBy.trim()) errs.createdBy = "Enter your name";
    rows.forEach((row, i) => {
      if (!row.ingredientId) errs[`ingredient_${i}`] = "Select ingredient";
      if (!row.julianCode.trim()) errs[`julian_${i}`] = "Enter Julian code";
      if (!row.quantityG || Number(row.quantityG) <= 0) errs[`qty_${i}`] = "Enter quantity";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    const inserts = rows.map(row => {
      const qty = Number(row.quantityG);
      return {
        ingredient_id: row.ingredientId,
        julian_code: row.julianCode.trim(),
        quantity_received_g: qty,
        quantity_remaining_g: qty,
        received_date: receivedDate,
        supplier: row.supplier.trim() || null,
        best_before_date: row.bestBefore || null,
        created_by: createdBy.trim(),
      };
    });

    const { error } = await supabase.from("ingredient_lots").insert(inserts);
    setSaving(false);

    if (error) {
      alert("Failed to save — please try again.");
      return;
    }

    setSaved(true);
    setRows([emptyRow()]);
    setErrors({});
    await load();
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-ghost text-xs px-2">← Dashboard</Link>
            <h1 className="text-base font-semibold text-gray-900">Goods In</h1>
          </div>
          <Link href="/admin/stock" className="btn-secondary text-xs">View Stock Levels</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Log incoming delivery</h2>
          <p className="text-xs text-gray-500 mb-5">Add one row per ingredient lot received.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Shared fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Date received *</label>
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Logged by *</label>
                <input
                  type="text"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  className={`input ${errors.createdBy ? "border-red-300" : ""}`}
                  placeholder="Your name"
                  autoComplete="name"
                />
                {errors.createdBy && <p className="mt-1 text-xs text-red-600">{errors.createdBy}</p>}
              </div>
            </div>

            {/* Per-ingredient rows */}
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={row.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Line {i + 1}</span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-xs text-red-500 hover:text-red-700 transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label className="label">Ingredient *</label>
                      <select
                        value={row.ingredientId}
                        onChange={(e) => updateRow(row.id, "ingredientId", e.target.value)}
                        className={`input ${errors[`ingredient_${i}`] ? "border-red-300" : ""}`}
                      >
                        <option value="">Select…</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name}</option>
                        ))}
                      </select>
                      {errors[`ingredient_${i}`] && <p className="mt-1 text-xs text-red-600">{errors[`ingredient_${i}`]}</p>}
                    </div>

                    <div>
                      <label className="label">Julian code *</label>
                      <input
                        type="text"
                        value={row.julianCode}
                        onChange={(e) => updateRow(row.id, "julianCode", e.target.value)}
                        className={`input ${errors[`julian_${i}`] ? "border-red-300" : ""}`}
                        placeholder="e.g. 26124"
                      />
                      {errors[`julian_${i}`] && <p className="mt-1 text-xs text-red-600">{errors[`julian_${i}`]}</p>}
                    </div>

                    <div>
                      <label className="label">Quantity (g) *</label>
                      <input
                        type="number"
                        value={row.quantityG}
                        onChange={(e) => updateRow(row.id, "quantityG", e.target.value)}
                        className={`input ${errors[`qty_${i}`] ? "border-red-300" : ""}`}
                        placeholder="0"
                        inputMode="numeric"
                        min="0"
                      />
                      {errors[`qty_${i}`] && <p className="mt-1 text-xs text-red-600">{errors[`qty_${i}`]}</p>}
                    </div>

                    <div>
                      <label className="label">Supplier</label>
                      <input
                        type="text"
                        value={row.supplier}
                        onChange={(e) => updateRow(row.id, "supplier", e.target.value)}
                        className="input"
                        placeholder="Optional"
                      />
                    </div>

                    <div>
                      <label className="label">Best before</label>
                      <input
                        type="date"
                        value={row.bestBefore}
                        onChange={(e) => updateRow(row.id, "bestBefore", e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition"
            >
              + Add another ingredient
            </button>

            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : `Save ${rows.length} line${rows.length !== 1 ? "s" : ""}`}
              </button>
              {saved && <span className="text-sm text-green-600 font-medium">Saved ✓</span>}
            </div>
          </form>
        </div>

        {/* Recent entries */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent deliveries</h2>
          {loading ? (
            <div className="card p-4 text-center text-sm text-gray-500">Loading…</div>
          ) : recentLots.length === 0 ? (
            <div className="card p-4 text-center text-sm text-gray-500">No deliveries logged yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Ingredient</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Julian code</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Received (g)</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Remaining (g)</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentLots.map(lot => (
                    <tr key={lot.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{lot.ingredient?.name}</td>
                      <td className="px-4 py-3 text-gray-700 font-mono">{lot.julian_code}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{lot.quantity_received_g.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={lot.quantity_remaining_g === 0 ? "text-gray-400 line-through" : "text-gray-900 font-medium"}>
                          {lot.quantity_remaining_g.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(lot.received_date)}</td>
                      <td className="px-4 py-3 text-gray-500">{lot.created_by}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
