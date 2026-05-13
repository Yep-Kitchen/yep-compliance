"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Dispatch, Submission, Checklist } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const SKUS = [
  "Garlic Chilli Oil",
  "Garlic Chilli Oil with Beef",
  "Sichuan Chilli Crisp",
  "Sichuan Chilli Crisp Double Heat",
  "Hunan Salted Chillies",
];

const CUSTOMERS = ["3PL", "Amazon", "Shopify", "Other"];

export default function GoodsOutPage() {
  const [recentDispatches, setRecentDispatches] = useState<Dispatch[]>([]);
  const [batchSubmissions, setBatchSubmissions] = useState<(Submission & { checklist: Checklist })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [product, setProduct] = useState("");
  const [customer, setCustomer] = useState("3PL");
  const [casesOf6, setCasesOf6] = useState("0");
  const [casesOf3, setCasesOf3] = useState("0");
  const [singles, setSingles] = useState("0");
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [dispatchedBy, setDispatchedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [batchSubmissionId, setBatchSubmissionId] = useState("");

  const totalUnits = Number(casesOf6) * 6 + Number(casesOf3) * 3 + Number(singles);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [dispRes, subRes] = await Promise.all([
      supabase
        .from("dispatches")
        .select("*")
        .order("dispatch_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("submissions")
        .select("id, submitted_by, submitted_at, checklist:checklists(name, category)")
        .eq("checklists.category", "Production")
        .order("submitted_at", { ascending: false })
        .limit(100),
    ]);
    if (dispRes.data) setRecentDispatches(dispRes.data as Dispatch[]);
    if (subRes.data) {
      const productionOnly = (subRes.data as unknown as (Submission & { checklist: Checklist })[]).filter(
        (s) => s.checklist?.category === "Production"
      );
      setBatchSubmissions(productionOnly);
    }
    setLoading(false);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!product) errs.product = "Select a product";
    if (!dispatchedBy.trim()) errs.dispatchedBy = "Enter your name";
    if (totalUnits <= 0) errs.units = "Enter at least one unit dispatched";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    const { error } = await supabase.from("dispatches").insert({
      dispatch_date: dispatchDate,
      product,
      customer,
      cases_of_6: Number(casesOf6) || 0,
      cases_of_3: Number(casesOf3) || 0,
      singles: Number(singles) || 0,
      reference: reference.trim() || null,
      dispatched_by: dispatchedBy.trim(),
      notes: notes.trim() || null,
      batch_submission_id: batchSubmissionId || null,
    });

    setSaving(false);
    if (error) {
      alert("Failed to save — please try again.");
      return;
    }

    setSaved(true);
    setProduct("");
    setCasesOf6("0");
    setCasesOf3("0");
    setSingles("0");
    setReference("");
    setBatchSubmissionId("");
    setNotes("");
    setErrors({});
    await load();
    setTimeout(() => setSaved(false), 3000);
  }

  // Filter batch submissions to match selected product
  const filteredBatchSubmissions = product
    ? batchSubmissions.filter((s) => s.checklist?.name?.startsWith(product))
    : batchSubmissions;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-ghost text-xs px-2">← Dashboard</Link>
            <h1 className="text-base font-semibold text-gray-900">Goods Out</h1>
          </div>
          <Link href="/admin/traceability" className="btn-secondary text-xs">Traceability</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-6">
        {/* Form */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Log dispatch</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Product */}
              <div className="sm:col-span-2">
                <label className="label">Product *</label>
                <select
                  value={product}
                  onChange={(e) => { setProduct(e.target.value); setBatchSubmissionId(""); }}
                  className={`input ${errors.product ? "border-red-300" : ""}`}
                >
                  <option value="">Select product…</option>
                  {SKUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.product && <p className="mt-1 text-xs text-red-600">{errors.product}</p>}
              </div>

              {/* Customer */}
              <div>
                <label className="label">Customer *</label>
                <select
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  className="input"
                >
                  {CUSTOMERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Dispatch date */}
              <div>
                <label className="label">Dispatch date *</label>
                <input
                  type="date"
                  value={dispatchDate}
                  onChange={(e) => setDispatchDate(e.target.value)}
                  className="input"
                />
              </div>

              {/* Cases of 6 */}
              <div>
                <label className="label">Cases of 6</label>
                <input
                  type="number"
                  min="0"
                  value={casesOf6}
                  onChange={(e) => setCasesOf6(e.target.value)}
                  className="input"
                  inputMode="numeric"
                />
              </div>

              {/* Cases of 3 */}
              <div>
                <label className="label">Cases of 3</label>
                <input
                  type="number"
                  min="0"
                  value={casesOf3}
                  onChange={(e) => setCasesOf3(e.target.value)}
                  className="input"
                  inputMode="numeric"
                />
              </div>

              {/* Singles */}
              <div>
                <label className="label">Singles</label>
                <input
                  type="number"
                  min="0"
                  value={singles}
                  onChange={(e) => setSingles(e.target.value)}
                  className="input"
                  inputMode="numeric"
                />
              </div>

              {/* Total units (read-only) */}
              <div>
                <label className="label">Total units</label>
                <div className={`input bg-gray-50 font-semibold tabular-nums ${totalUnits > 0 ? "text-gray-900" : "text-gray-400"}`}>
                  {totalUnits}
                </div>
                {errors.units && <p className="mt-1 text-xs text-red-600">{errors.units}</p>}
              </div>

              {/* Reference */}
              <div>
                <label className="label">Order reference</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="input"
                  placeholder="Optional"
                />
              </div>

              {/* Batch record link */}
              <div className="sm:col-span-2">
                <label className="label">Link to batch record (for traceability)</label>
                <select
                  value={batchSubmissionId}
                  onChange={(e) => setBatchSubmissionId(e.target.value)}
                  className="input"
                  disabled={!product}
                >
                  <option value="">No link / select later…</option>
                  {filteredBatchSubmissions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.checklist?.name?.replace(" — Production Record", "")} · {formatDate(s.submitted_at.slice(0, 10))} · by {s.submitted_by}
                    </option>
                  ))}
                </select>
                {!product && (
                  <p className="mt-1 text-xs text-gray-400">Select a product first to filter batch records</p>
                )}
              </div>

              {/* Dispatched by */}
              <div>
                <label className="label">Dispatched by *</label>
                <input
                  type="text"
                  value={dispatchedBy}
                  onChange={(e) => setDispatchedBy(e.target.value)}
                  className={`input ${errors.dispatchedBy ? "border-red-300" : ""}`}
                  placeholder="Your name"
                  autoComplete="name"
                />
                {errors.dispatchedBy && <p className="mt-1 text-xs text-red-600">{errors.dispatchedBy}</p>}
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : "Log dispatch"}
              </button>
              {saved && <span className="text-sm text-green-600 font-medium">Saved ✓</span>}
            </div>
          </form>
        </div>

        {/* Recent dispatches */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent dispatches</h2>
          {loading ? (
            <div className="card p-4 text-center text-sm text-gray-500">Loading…</div>
          ) : recentDispatches.length === 0 ? (
            <div className="card p-4 text-center text-sm text-gray-500">No dispatches logged yet.</div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">×6</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">×3</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Singles</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Units</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Ref</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentDispatches.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(d.dispatch_date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{d.product}</td>
                      <td className="px-4 py-3 text-gray-600">{d.customer}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{d.cases_of_6 || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{d.cases_of_3 || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{d.singles || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">{d.total_units}</td>
                      <td className="px-4 py-3 text-gray-500">{d.reference ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{d.dispatched_by}</td>
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
