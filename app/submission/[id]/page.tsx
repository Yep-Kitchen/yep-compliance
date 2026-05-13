"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Checklist, Submission, Answer, Question } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type FullSubmission = Submission & {
  checklist: Checklist;
  answers: (Answer & { question: Question })[];
};

export default function SubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [submission, setSubmission] = useState<FullSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOff, setSigningOff] = useState(false);
  const [managerName, setManagerName] = useState("Tom Palmer");
  const [showSignOff, setShowSignOff] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const { data, error } = await supabase
      .from("submissions")
      .select(`
        *,
        checklist:checklists(*),
        answers(*, question:questions(*))
      `)
      .eq("id", id)
      .single();

    if (error) { setLoading(false); return; }

    // Sort answers by question order
    if (data.answers) {
      data.answers.sort((a: Answer & { question: Question }, b: Answer & { question: Question }) =>
        (a.question?.order_index ?? 0) - (b.question?.order_index ?? 0)
      );
    }

    setSubmission(data as FullSubmission);
    setNotes(data.notes ?? "");
    setLoading(false);
  }

  async function handleSignOff() {
    if (!managerName.trim()) return;
    setSigningOff(true);

    const { error } = await supabase
      .from("submissions")
      .update({
        signed_off_by: managerName.trim(),
        signed_off_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq("id", id);

    if (!error) {
      await load();
      setShowSignOff(false);
    } else {
      alert("Sign-off failed — please try again.");
    }
    setSigningOff(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p className="text-gray-600">Submission not found.</p>
      </div>
    );
  }

  const isSigned = !!submission.signed_off_at;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-ghost text-xs px-2">
              ← Dashboard
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-700">{submission.checklist?.name}</span>
          </div>
          {isSigned ? (
            <span className="badge bg-green-100 text-green-700 px-3 py-1">Signed off ✓</span>
          ) : (
            <span className="badge bg-amber-100 text-amber-700 px-3 py-1">Pending review</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        {/* Meta */}
        <div className="card p-5 space-y-3">
          <h1 className="text-xl font-bold text-gray-900">{submission.checklist?.name}</h1>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Submitted by</p>
              <p className="mt-0.5 font-medium text-gray-900">{submission.submitted_by}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Submitted at</p>
              <p className="mt-0.5 font-medium text-gray-900">{formatDateTime(submission.submitted_at)}</p>
            </div>
            {isSigned && (
              <>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Signed off by</p>
                  <p className="mt-0.5 font-medium text-green-700">{submission.signed_off_by}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Signed off at</p>
                  <p className="mt-0.5 font-medium text-gray-900">{formatDateTime(submission.signed_off_at!)}</p>
                </div>
              </>
            )}
          </div>
          {submission.notes && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500 font-medium mb-1">Manager notes</p>
              <p className="text-sm text-gray-700">{submission.notes}</p>
            </div>
          )}
        </div>

        {/* Answers */}
        <div className="card divide-y divide-gray-100">
          {submission.answers.map((a) => (
            <AnswerRow key={a.id} answer={a} />
          ))}
        </div>

        {/* Sign off */}
        {!isSigned && (
          <div className="card p-5">
            {!showSignOff ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">Ready to sign off?</p>
                  <p className="text-sm text-gray-500">Review the answers above, then sign off to confirm.</p>
                </div>
                <button onClick={() => setShowSignOff(true)} className="btn-primary">
                  Sign off
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Manager Sign-Off</h3>
                <div>
                  <label className="label">Your name</label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    className="input"
                    placeholder="Manager name"
                  />
                </div>
                <div>
                  <label className="label">Notes (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="input resize-none"
                    placeholder="Any notes or observations…"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSignOff}
                    disabled={signingOff || !managerName.trim()}
                    className="btn-primary flex-1"
                  >
                    {signingOff ? "Signing off…" : "Confirm sign-off"}
                  </button>
                  <button onClick={() => setShowSignOff(false)} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function AnswerRow({ answer }: { answer: Answer }) {
  const q = answer.question;
  const val = answer.value;

  let display: React.ReactNode;

  if (!val || val === "null") {
    display = <span className="text-gray-400 text-sm italic">Not answered</span>;
  } else if (q?.type === "checkbox") {
    display = (
      <span className={`badge ${val === "true" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
        {val === "true" ? "✓ Yes / Pass" : "✗ No / Fail"}
      </span>
    );
  } else if (q?.type === "photo") {
    display = val.startsWith("http") ? (
      <a href={val} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={val} alt="Photo" className="mt-1 h-32 rounded-lg object-cover border border-gray-200 hover:opacity-90 transition" />
      </a>
    ) : <span className="text-gray-400 text-sm italic">Photo not available</span>;
  } else if (q?.type === "signature") {
    display = val.startsWith("data:") ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={val} alt="Signature" className="mt-1 h-16 rounded border border-gray-200 bg-white" />
    ) : <span className="text-gray-400 text-sm italic">No signature</span>;
  } else if (q?.type === "multiple_choice") {
    const items: string[] = JSON.parse(val);
    display = (
      <div className="flex flex-wrap gap-1 mt-1">
        {items.map((i) => <span key={i} className="badge bg-blue-100 text-blue-700">{i}</span>)}
      </div>
    );
  } else {
    display = <p className="text-sm text-gray-900">{val}</p>;
  }

  return (
    <div className="px-5 py-3">
      <p className="text-xs text-gray-500 font-medium mb-0.5">{q?.label ?? "Question"}</p>
      {display}
    </div>
  );
}
