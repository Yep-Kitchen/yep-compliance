"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Ingredient, IngredientLot } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export default function GoodsInPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recentLots, setRecentLots] = useState<(IngredientLot & { ingredient: Ingredient })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [ingredientId, setIngredientId] = useState("");
  const [julianCode, setJulianCode] = useState("");
  const [quantityG, setQuantityG] = useState("");
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [bestBefore, setBestBefore] = useState("");
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

  function validate() {
    const errs: Record<string, string> = {};
    if (!ingredientId) errs.ingredient = "Select an ingredient";
    if (!julianCode.trim()) errs.julianCode = "Enter a Julian code";
    if (!quantityG || Number(quantityG) <= 0) errs.quantity = "Enter a valid quantity";
    if (!createdBy.trim()) errs.createdBy = "Enter your name";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const qty = Number(quantityG);
    const { error } = await supabase.from("ingredient_lots").insert({
      ingredient_id: ingredientId,
      julian_code: julianCode.trim(),
      quantity_received_g: qty,
      quantity_remaining_g: qty,
      received_date: receivedDate,
      supplier: supplier.trim() || null,
      best_before_date: bestBefore || null,
      created_by: createdBy.trim(),
    });
    setSaving(false);
    if (error) {
      alert("Failed to save — please try again.");
      return;
    }
    setSaved(true);
    setIngredientId("");
    setJulianCode("");
    setQuantityG("");
    setSupplier("");
    setBestBefore("");
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

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-6">
        {/* Form */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Log incoming delivery</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">Ingredient *</label>
                <select
                  value={ingredientId}
                  onChange={(e) => setIngredientId(e.target.value)}
                  className={`input ${errors.ingredient ? "border-red-300" : ""}`}
                >
                  <option value="">Select ingredient…</option>
                  {ingredients.map((ing) => (
                    <option key={ing.id} value={ing.id}>{ing.name}</option>
                  ))}
                </select>
                {errors.ingredient && <p className="mt-1 text-xs text-red-600">{errors.ingredient}</p>}
              </div>

              <div>
                <label className="label">Julian code *</label>
                <input
                  type="text"
                  value={julianCode}
                  onChange={(e) => setJulianCode(e.target.value)}
                  className={`input ${errors.julianCode ? "border-red-300" : ""}`}
                  placeholder="e.g. 26124"
                />
                {errors.julianCode && <p className="mt-1 text-xs text-red-600">{errors.julianCode}</p>}
              </div>

              <div>
                <label className="label">Quantity received (g) *</label>
                <input
                  type="number"
                  value={quantityG}
                  onChange={(e) => setQuantityG(e.target.value)}
                  className={`input ${errors.quantity ? "border-red-300" : ""}`}
                  placeholder="0"
                  inputMode="numeric"
                />
                {errors.quantity && <p className="mt-1 text-xs text-red-600">{errors.quantity}</p>}
              </div>

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
                <label className="label">Supplier</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="input"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="label">Best before date</label>
                <input
                  type="date"
                  value={bestBefore}
                  onChange={(e) => setBestBefore(e.target.value)}
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

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : "Log delivery"}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentLots.map((lot) => (
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
