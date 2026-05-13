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

interface DispatchRow {
  id: string;
  product: string;
  casesOf6: string;
  casesOf3: string;
  singles: string;
  batchSubmissionId: string;
}

function emptyRow(): DispatchRow {
  return {
    id: crypto.randomUUID(),
    product: "",
    casesOf6: "0",
    casesOf3: "0",
    singles: "0",
    batchSubmissionId: "",
  };
}

export default function GoodsOutPage() {
  const [recentDispatches, setRecentDispatches] = useState<Dispatch[]>([]);
  const [batchSubmissions, setBatchSubmissions] = useState<(Submission & { checklist: Checklist })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [rows, setRows] = useState<DispatchRow[]>([emptyRow()]);
  const [customer, setCustomer] = useState("3PL");
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [dispatchedBy, setDispatchedBy] = useState("");
  const [notes, setNotes] = useState("");

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
        .order("submitted_at", { ascending: false })
        .limit(100),
    ]);
    if (dispRes.data) setRecentDispatches(dispRes.data as Dispatch[]);
    if (subRes.data) {
      const productionOnly = (subRes.data as unknown as (Submission & { checklist: Checklist })[]).filter(
        s => s.checklist?.category === "Production"
      );
      setBatchSubmissions(productionOnly);
    }
    setLoading(false);
  }

  function updateRow(id: string, field: keyof DispatchRow, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  }

  function rowTotal(row: DispatchRow) {
    return Number(row.casesOf6) * 6 + Number(row.casesOf3) * 3 + Number(row.singles);
  }

  const grandTotal = rows.reduce((s, r) => s + rowTotal(r), 0);

  function validate() {
    const errs: Record<string, string> = {};
    if (!dispatchedBy.trim()) errs.dispatchedBy = "Enter your name";
    rows.forEach((row, i) => {
      if (!row.product) errs[`product_${i}`] = "Select a product";
      if (rowTotal(row) <= 0) errs[`units_${i}`] = "Enter at least one unit";
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    const inserts = rows.map(row => ({
      dispatch_date: dispatchDate,
      product: row.product,
      customer,
      cases_of_6: Number(row.casesOf6) || 0,
      cases_of_3: Number(row.casesOf3) || 0,
      singles: Number(row.singles) || 0,
      total_units: rowTotal(row),
      reference: reference.trim() || null,
      dispatched_by: dispatchedBy.trim(),
      notes: notes.trim() || null,
      batch_submission_id: row.batchSubmissionId || null,
    }));

    const { error } = await supabase.from("dispatches").insert(inserts);
    setSaving(false);

    if (error) {
      alert("Failed to save — please try again.");
      return;
    }

    setSaved(true);
    setRows([emptyRow()]);
    setReference("");
    setNotes("");
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
            <h1 className="text-base font-semibold text-gray-900">Goods Out</h1>
          </div>
          <Link href="/admin/traceability" className="btn-secondary text-xs">Traceability</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Log dispatch</h2>
          <p className="text-xs text-gray-500 mb-5">Add one row per product line dispatched.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Shared fields */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label">Customer *</label>
                <select value={customer} onChange={e => setCustomer(e.target.value)} className="input">
                  {CUSTOMERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Dispatch date *</label>
                <input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Order reference</label>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)} className="input" placeholder="Optional" />
              </div>
              <div>
                <label className="label">Dispatched by *</label>
                <input
                  type="text"
                  value={dispatchedBy}
                  onChange={e => setDispatchedBy(e.target.value)}
                  className={`input ${errors.dispatchedBy ? "border-red-300" : ""}`}
                  placeholder="Your name"
                  autoComplete="name"
                />
                {errors.dispatchedBy && <p className="mt-1 text-xs text-red-600">{errors.dispatchedBy}</p>}
              </div>
            </div>

            {/* Per-product rows */}
            <div className="space-y-3">
              {rows.map((row, i) => {
                const filteredBatches = row.product
                  ? batchSubmissions.filter(s => s.checklist?.name?.startsWith(row.product))
                  : batchSubmissions;
                const total = rowTotal(row);
                return (
                  <div key={row.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Line {i + 1}</span>
                      {rows.length > 1 && (
                        <button type="button" onClick={() => removeRow(row.id)} className="text-xs text-red-500 hover:text-red-700 transition">
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="sm:col-span-2">
                        <label className="label">Product *</label>
                        <select
                          value={row.product}
                          onChange={e => updateRow(row.id, "product", e.target.value)}
                          className={`input ${errors[`product_${i}`] ? "border-red-300" : ""}`}
                        >
                          <option value="">Select product…</option>
                          {SKUS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {errors[`product_${i}`] && <p className="mt-1 text-xs text-red-600">{errors[`product_${i}`]}</p>}
                      </div>

                      <div>
                        <label className="label">Cases of 6</label>
                        <input
                          type="number" min="0"
                          value={row.casesOf6}
                          onChange={e => updateRow(row.id, "casesOf6", e.target.value)}
                          className="input" inputMode="numeric"
                        />
                      </div>

                      <div>
                        <label className="label">Cases of 3</label>
                        <input
                          type="number" min="0"
                          value={row.casesOf3}
                          onChange={e => updateRow(row.id, "casesOf3", e.target.value)}
                          className="input" inputMode="numeric"
                        />
                      </div>

                      <div>
                        <label className="label">Singles</label>
                        <input
                          type="number" min="0"
                          value={row.singles}
                          onChange={e => updateRow(row.id, "singles", e.target.value)}
                          className="input" inputMode="numeric"
                        />
                      </div>

                      <div>
                        <label className="label">Total units</label>
                        <div className={`input bg-white font-bold tabular-nums ${total > 0 ? "text-gray-900" : "text-gray-300"}`}>
                          {total}
                        </div>
                        {errors[`units_${i}`] && <p className="mt-1 text-xs text-red-600">{errors[`units_${i}`]}</p>}
                      </div>

                      <div className="sm:col-span-2">
                        <label className="label">Link batch record</label>
                        <select
                          value={row.batchSubmissionId}
                          onChange={e => updateRow(row.id, "batchSubmissionId", e.target.value)}
                          className="input"
                          disabled={!row.product}
                        >
                          <option value="">No link…</option>
                          {filteredBatches.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.checklist?.name?.replace(" — Production Record", "")} · {formatDate(s.submitted_at.slice(0, 10))} · {s.submitted_by}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700 transition"
            >
              + Add another product line
            </button>

            {grandTotal > 0 && (
              <p className="text-sm text-gray-600 font-medium">
                Total dispatch: <span className="font-bold text-gray-900">{grandTotal} units</span>
              </p>
            )}

            <div>
              <label className="label">Notes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="Optional" />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : `Log dispatch (${rows.length} line${rows.length !== 1 ? "s" : ""})`}
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
                  {recentDispatches.map(d => (
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
