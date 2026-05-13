"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Checklist, Question } from "@/lib/types";
import QuestionField from "@/components/QuestionField";
import { frequencyLabel } from "@/lib/utils";

type AnswerMap = Record<string, string>;

export default function ChecklistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submittedBy, setSubmittedBy] = useState("");

  useEffect(() => {
    async function load() {
      const [clRes, qRes] = await Promise.all([
        supabase.from("checklists").select("*").eq("id", id).single(),
        supabase.from("questions").select("*").eq("checklist_id", id).order("order_index"),
      ]);
      if (clRes.data) setChecklist(clRes.data);
      if (qRes.data) setQuestions(qRes.data);
      setLoading(false);
    }
    load();
  }, [id]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!submittedBy.trim()) errs["__name"] = "Please enter your name";
    for (const q of questions) {
      if (!q.required) continue;
      const val = answers[q.id] ?? "";
      if (!val || val === "false" || val === "[]") {
        errs[q.id] = "This field is required";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      const firstErr = document.querySelector("[data-error]");
      firstErr?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);

    // Upload any base64 photos to Supabase Storage
    const processedAnswers: AnswerMap = { ...answers };
    for (const q of questions) {
      if (q.type === "photo" && processedAnswers[q.id]?.startsWith("data:")) {
        const base64 = processedAnswers[q.id];
        const blob = await (await fetch(base64)).blob();
        const ext = blob.type.split("/")[1] ?? "jpg";
        const path = `photos/${id}/${Date.now()}-${q.id}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("compliance-photos")
          .upload(path, blob, { contentType: blob.type, upsert: false });
        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from("compliance-photos").getPublicUrl(path);
          processedAnswers[q.id] = urlData.publicUrl;
        }
      }
    }

    // Submit via API route
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checklist_id: id,
        submitted_by: submittedBy.trim(),
        answers: questions.map((q) => ({
          question_id: q.id,
          value: processedAnswers[q.id] ?? null,
        })),
      }),
    });

    setSubmitting(false);

    if (res.ok) {
      setSubmitted(true);
    } else {
      alert("Something went wrong — please try again.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">Checklist not found</p>
          <p className="mt-1 text-sm text-gray-500">Check the QR code and try again.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="card max-w-sm w-full p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 overflow-hidden">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Submitted!</h2>
          <p className="mt-2 text-sm text-gray-600">
            {checklist.name} has been recorded. Thank you, {submittedBy}.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setAnswers({});
              setSubmittedBy("");
              setErrors({});
            }}
            className="btn-primary mt-6 w-full"
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Yep Kitchen" className="h-8 w-auto" />
            <div>
              <h1 className="text-sm font-semibold text-gray-900 leading-tight">{checklist.name}</h1>
              <p className="text-xs text-gray-500">{frequencyLabel(checklist.frequency as never)}</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="pb-safe">
        <div className="mx-auto max-w-xl px-4 py-4 space-y-4">
          {checklist.description && (
            <p className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              {checklist.description}
            </p>
          )}

          {/* Name field */}
          <div data-error={errors["__name"] ? true : undefined}>
            <label className="label">
              Your name <span className="text-brand">*</span>
            </label>
            <input
              type="text"
              value={submittedBy}
              onChange={(e) => setSubmittedBy(e.target.value)}
              className={`input ${errors["__name"] ? "border-red-300" : ""}`}
              placeholder="Full name"
              autoComplete="name"
            />
            {errors["__name"] && <p className="mt-1 text-xs text-red-600">{errors["__name"]}</p>}
          </div>

          {/* Questions */}
          {questions.map((q) => (
            <div key={q.id} data-error={errors[q.id] ? true : undefined}>
              <QuestionField
                question={q}
                value={answers[q.id] ?? ""}
                onChange={(val) => setAnswers((prev) => ({ ...prev, [q.id]: val }))}
                error={errors[q.id]}
              />
            </div>
          ))}

          {Object.keys(errors).length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Please fill in all required fields before submitting.
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-3 text-base"
          >
            {submitting ? "Submitting…" : "Submit checklist"}
          </button>

          <p className="text-center text-xs text-gray-400 pb-8">
            Yep Kitchen · SALSA Compliance Portal
          </p>
        </div>
      </form>
    </div>
  );
}
