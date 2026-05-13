"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Checklist, Submission } from "@/lib/types";
import { formatDateTime, frequencyLabel, frequencyBadgeColor } from "@/lib/utils";

type SubmissionWithChecklist = Submission & { checklist: Checklist };

export default function SubmissionsPage() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionWithChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterChecklist, setFilterChecklist] = useState("");
  const [filterSigned, setFilterSigned] = useState<"all" | "pending" | "signed">("all");

  useEffect(() => {
    async function load() {
      const [clRes, subRes] = await Promise.all([
        supabase.from("checklists").select("*").eq("active", true).order("name"),
        supabase
          .from("submissions")
          .select("*, checklist:checklists(*)")
          .order("submitted_at", { ascending: false })
          .limit(200),
      ]);
      if (clRes.data) setChecklists(clRes.data);
      if (subRes.data) setSubmissions(subRes.data as SubmissionWithChecklist[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = submissions.filter((s) => {
    if (filterChecklist && s.checklist_id !== filterChecklist) return false;
    if (filterSigned === "pending" && s.signed_off_at) return false;
    if (filterSigned === "signed" && !s.signed_off_at) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-ghost text-xs px-2">← Dashboard</Link>
            <h1 className="text-base font-semibold text-gray-900">All Submissions</h1>
          </div>
          <span className="text-sm text-gray-500">{filtered.length} records</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-4">
        {/* Filters */}
        <div className="card p-4 flex flex-wrap gap-3">
          <select
            value={filterChecklist}
            onChange={(e) => setFilterChecklist(e.target.value)}
            className="input max-w-xs"
          >
            <option value="">All checklists</option>
            {checklists.map((cl) => (
              <option key={cl.id} value={cl.id}>{cl.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            {(["all", "pending", "signed"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterSigned(v)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  filterSigned === v ? "bg-brand text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {v === "all" ? "All" : v === "pending" ? "Pending" : "Signed off"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="card p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-sm text-gray-500">No submissions found.</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Checklist</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Submitted by</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Date / Time</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{s.checklist?.name}</p>
                        <span className={`badge text-xs mt-0.5 ${frequencyBadgeColor(s.checklist?.frequency as never)}`}>
                          {frequencyLabel(s.checklist?.frequency as never)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{s.submitted_by}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDateTime(s.submitted_at)}</td>
                      <td className="px-4 py-3">
                        {s.signed_off_at ? (
                          <span className="badge bg-green-100 text-green-700">Signed off</span>
                        ) : (
                          <span className="badge bg-amber-100 text-amber-700">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/submission/${s.id}`} className="text-brand hover:underline font-medium">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
