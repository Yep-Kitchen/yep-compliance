"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Ingredient, IngredientLot } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface IngredientRow {
  ingredientId: string;
  julianCode: string;
  bestBefore: string;
  quantityG: string;
}

function emptyRow(): IngredientRow {
  return { ingredientId: "", julianCode: "", bestBefore: "", quantityG: "" };
}

export default function GoodsInPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recentLots, setRecentLots] = useState<(IngredientLot & { ingredient: Ingredient })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [rows, setRows] = useState<IngredientRow[]>([emptyRow()]);
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [loggedBy, setLoggedBy] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { load(); }, []);

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

  function updateRow(idx: number, field: keyof IngredientRow, value: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()]);
  }

  function removeRow(idx: number) {
    if (rows.length > 1) setRows(prev => prev.filter((_, i) => i !== idx));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!loggedBy.trim()) errs.loggedBy = "Enter your name";
    rows.forEach((row, i) => {
      if (!row.ingredientId) errs[`name_${i}`] = "Required";
      if (!row.julianCode.trim()) errs[`batch_${i}`] = "Required";
      if (!row.quantityG || Number(row.quantityG) <= 0) errs[`qty_${i}`] = "Required";
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
        supplier: supplier.trim() || null,
        best_before_date: row.bestBefore || null,
        created_by: loggedBy.trim(),
      };
    });

    const { error } = await supabase.from("ingredient_lots").insert(inserts);
    setSaving(false);
    if (error) { alert("Failed to save — please try again."); return; }

    setSaved(true);
    setRows([emptyRow()]);
    setSupplier("");
    setErrors({});
    await load();
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-ghost text-xs px-2">← Dashboard</Link>
            <h1 className="text-base font-semibold text-gray-900">Goods In</h1>
          </div>
          <Link href="/admin/stock" className="btn-secondary text-xs">View Stock Levels</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6 sm:px-10 space-y-6">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Log incoming delivery</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Shared delivery details */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Date received *</label>
                <input
                  type="date"
                  value={receivedDate}
                  onChange={e => setReceivedDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Supplier</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  className="input"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="label">Logged by *</label>
                <input
                  type="text"
                  value={loggedBy}
                  onChange={e => setLoggedBy(e.target.value)}
                  className={`input ${errors.loggedBy ? "border-red-300" : ""}`}
                  placeholder="Your name"
                  autoComplete="name"
                />
                {errors.loggedBy && <p className="mt-1 text-xs text-red-600">{errors.loggedBy}</p>}
              </div>
            </div>

            {/* Ingredient cards */}
            <div className="space-y-3">
              {rows.map((row, idx) => (
                <div key={idx} className="rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Ingredient {idx + 1}
                    </p>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-xs text-gray-400 hover:text-red-500 transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Name */}
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 block mb-0.5">Name *</label>
                      <select
                        value={row.ingredientId}
                        onChange={e => updateRow(idx, "ingredientId", e.target.value)}
                        className={`input text-sm py-1.5 ${errors[`name_${idx}`] ? "border-red-300" : ""}`}
                      >
                        <option value="">Select ingredient…</option>
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name}</option>
                        ))}
                      </select>
                      {errors[`name_${idx}`] && <p className="mt-0.5 text-xs text-red-500">{errors[`name_${idx}`]}</p>}
                    </div>

                    {/* Batch code */}
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">Batch code *</label>
                      <input
                        type="text"
                        value={row.julianCode}
                        onChange={e => updateRow(idx, "julianCode", e.target.value)}
                        className={`input text-sm py-1.5 ${errors[`batch_${idx}`] ? "border-red-300" : ""}`}
                        placeholder="e.g. 26124"
                      />
                      {errors[`batch_${idx}`] && <p className="mt-0.5 text-xs text-red-500">{errors[`batch_${idx}`]}</p>}
                    </div>

                    {/* BBE */}
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">BBE date</label>
                      <input
                        type="date"
                        value={row.bestBefore}
                        onChange={e => updateRow(idx, "bestBefore", e.target.value)}
                        className="input text-sm py-1.5"
                      />
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">Quantity (g) *</label>
                      <input
                        type="number"
                        value={row.quantityG}
                        onChange={e => updateRow(idx, "quantityG", e.target.value)}
                        className={`input text-sm py-1.5 ${errors[`qty_${idx}`] ? "border-red-300" : ""}`}
                        placeholder="0"
                        inputMode="numeric"
                        min="0"
                      />
                      {errors[`qty_${idx}`] && <p className="mt-0.5 text-xs text-red-500">{errors[`qty_${idx}`]}</p>}
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addRow}
                className="w-full rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm text-gray-500 hover:border-brand hover:text-brand transition"
              >
                + Add another ingredient
              </button>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : `Save ${rows.length} ingredient${rows.length !== 1 ? "s" : ""}`}
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
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Batch code</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Received (g)</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Remaining (g)</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">BBE</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Date in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentLots.map(lot => (
                    <tr key={lot.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{lot.ingredient?.name}</td>
                      <td className="px-4 py-3 font-mono text-gray-700">{lot.julian_code}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{lot.quantity_received_g.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={lot.quantity_remaining_g === 0 ? "text-gray-400 line-through" : "text-gray-900 font-medium"}>
                          {lot.quantity_remaining_g.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{lot.best_before_date ? formatDate(lot.best_before_date) : "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(lot.received_date)}</td>
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
