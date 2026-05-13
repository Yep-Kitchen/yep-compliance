"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Checklist, Question } from "@/lib/types";
import QuestionField from "@/components/QuestionField";
import { frequencyLabel } from "@/lib/utils";

type AnswerMap = Record<string, string>;

interface BatchDraft {
  id: string;
  checklist_id: string;
  started_by: string;
  last_saved_at: string;
  answers: AnswerMap;
}

function isFieldFilled(q: Question, val: string): boolean {
  if (!val) return false;
  if (q.type === "checkbox") return val === "true";
  if (q.type === "ingredient_table") {
    try {
      const rows = JSON.parse(val) as Array<{ batch_code: string; actual_weight: string }>;
      return rows.length > 0 && rows.every((r) => r.batch_code?.trim() && r.actual_weight?.trim());
    } catch { return false; }
  }
  if (q.type === "packing_runs") {
    try {
      const runs = JSON.parse(val) as Array<{ pack_weight: string; jars_used: string }>;
      return runs.some((r) => r.pack_weight?.trim() && r.jars_used?.trim());
    } catch { return false; }
  }
  return val !== "false" && val !== "[]" && val.trim() !== "";
}

export default function ChecklistPage() {
  const { id } = useParams<{ id: string }>();

  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submittedBy, setSubmittedBy] = useState("");

  // Draft save state (Production checklists only)
  const [existingDraft, setExistingDraft] = useState<BatchDraft | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftIdRef = useRef<string | null>(null);

  const isProduction = checklist?.category === "Production";

  useEffect(() => {
    async function load() {
      const [clRes, qRes] = await Promise.all([
        supabase.from("checklists").select("*").eq("id", id).single(),
        supabase.from("questions").select("*").eq("checklist_id", id).order("order_index"),
      ]);
      if (clRes.data) setChecklist(clRes.data);
      if (qRes.data) setQuestions(qRes.data);

      // Check for existing draft if this is a production checklist
      if (clRes.data?.category === "Production") {
        const { data: drafts } = await supabase
          .from("batch_drafts")
          .select("*")
          .eq("checklist_id", id)
          .order("last_saved_at", { ascending: false })
          .limit(1);
        if (drafts && drafts.length > 0) {
          setExistingDraft(drafts[0] as BatchDraft);
          setShowResumePrompt(true);
        }
      }

      setLoading(false);
    }
    load();
  }, [id]);

  // Keep draftIdRef in sync so the save closure always has the current id
  useEffect(() => { draftIdRef.current = draftId; }, [draftId]);

  const scheduleDraftSave = useCallback((newAnswers: AnswerMap, by: string) => {
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    setDraftStatus("saving");
    draftSaveTimer.current = setTimeout(async () => {
      let currentId = draftIdRef.current;
      if (!currentId) {
        currentId = crypto.randomUUID();
        setDraftId(currentId);
        draftIdRef.current = currentId;
      }
      await supabase.from("batch_drafts").upsert({
        id: currentId,
        checklist_id: id,
        started_by: by || "Unknown",
        last_saved_at: new Date().toISOString(),
        answers: newAnswers,
      });
      setDraftStatus("saved");
    }, 2000);
  }, [id]);

  function handleAnswerChange(questionId: string, val: string) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: val };
      if (isProduction && !showResumePrompt) scheduleDraftSave(next, submittedBy);
      return next;
    });
    if (errors[questionId]) setErrors((prev) => { const e = { ...prev }; delete e[questionId]; return e; });
  }

  function handleNameChange(val: string) {
    setSubmittedBy(val);
    if (isProduction && !showResumePrompt) scheduleDraftSave(answers, val);
    if (errors["__name"]) setErrors((prev) => { const e = { ...prev }; delete e["__name"]; return e; });
  }

  async function resumeDraft() {
    if (!existingDraft) return;
    setDraftId(existingDraft.id);
    draftIdRef.current = existingDraft.id;
    setAnswers(existingDraft.answers ?? {});
    setSubmittedBy(existingDraft.started_by ?? "");
    setShowResumePrompt(false);
  }

  async function startFresh() {
    if (existingDraft) {
      await supabase.from("batch_drafts").delete().eq("id", existingDraft.id);
    }
    setExistingDraft(null);
    setShowResumePrompt(false);
    // Draft ID will be created on first field change
  }

  // Progress calculation for production checklists
  function calcProgress() {
    const required = questions.filter((q) => q.required);
    const filledCount = required.filter((q) => isFieldFilled(q, answers[q.id] ?? "")).length;
    const nameOk = submittedBy.trim().length > 0;
    return { filled: filledCount + (nameOk ? 1 : 0), total: required.length + 1 };
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!submittedBy.trim()) errs["__name"] = "Please enter your name";
    for (const q of questions) {
      if (!q.required) continue;
      const val = answers[q.id] ?? "";
      if (q.type === "ingredient_table") {
        try {
          const rows = JSON.parse(val) as Array<{ batch_code: string; actual_weight: string }>;
          if (!rows.every((r) => r.batch_code?.trim() && r.actual_weight?.trim())) {
            errs[q.id] = "Please fill in batch code and actual weight for all ingredients";
          }
        } catch { errs[q.id] = "Please complete the ingredient table"; }
      } else if (q.type === "packing_runs") {
        try {
          const runs = JSON.parse(val) as Array<{ pack_weight: string; jars_used: string }>;
          if (!runs.some((r) => r.pack_weight?.trim() && r.jars_used?.trim())) {
            errs[q.id] = "Please complete at least one packing run";
          }
        } catch { errs[q.id] = "Please complete the packing log"; }
      } else if (!val || val === "false" || val === "[]") {
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

    if (res.ok && isProduction && draftIdRef.current) {
      await supabase.from("batch_drafts").delete().eq("id", draftIdRef.current);
    }

    setSubmitting(false);

    if (res.ok) {
      setSubmitted(true);
    } else {
      alert("Something went wrong — please try again.");
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

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

  // ── Resume prompt (Production only) ─────────────────────────────────────────

  if (isProduction && showResumePrompt && existingDraft) {
    const savedAt = new Date(existingDraft.last_saved_at);
    const timeAgo = Math.round((Date.now() - savedAt.getTime()) / 60000);
    const timeLabel = timeAgo < 60
      ? `${timeAgo} min${timeAgo !== 1 ? "s" : ""} ago`
      : `${Math.round(timeAgo / 60)} hr${Math.round(timeAgo / 60) !== 1 ? "s" : ""} ago`;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
          <div className="px-4 py-3 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Yep Kitchen" className="h-8 w-auto" />
            <div>
              <h1 className="text-sm font-semibold text-gray-900 leading-tight">{checklist.name}</h1>
              <p className="text-xs text-gray-500">Production Record</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="card max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">In-progress batch found</p>
                <p className="text-xs text-gray-500">Started by {existingDraft.started_by} · {timeLabel}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              There is an unfinished batch record for this product. Do you want to continue where it left off, or start a new record?
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={resumeDraft} className="btn-primary w-full">
                Resume this batch
              </button>
              <button onClick={startFresh} className="btn-secondary w-full">
                Start a new batch
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Submitted ────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="card max-w-sm w-full p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 overflow-hidden">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {isProduction ? "Batch record submitted!" : "Submitted!"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {checklist.name} has been recorded. Thank you, {submittedBy}.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setAnswers({});
              setSubmittedBy("");
              setErrors({});
              setDraftId(null);
              draftIdRef.current = null;
              setDraftStatus("idle");
            }}
            className="btn-primary mt-6 w-full"
          >
            {isProduction ? "Start another batch" : "Submit another"}
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────────

  const progress = isProduction ? calcProgress() : null;
  const allComplete = progress ? progress.filled === progress.total : true;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Yep Kitchen" className="h-8 w-auto shrink-0" />
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-gray-900 leading-tight truncate">{checklist.name}</h1>
                <p className="text-xs text-gray-500">{frequencyLabel(checklist.frequency as never)}</p>
              </div>
            </div>
            {/* Draft save indicator */}
            {isProduction && draftId && (
              <div className="shrink-0">
                {draftStatus === "saving" && (
                  <span className="text-xs text-gray-400">Saving…</span>
                )}
                {draftStatus === "saved" && (
                  <span className="text-xs text-green-600">Saved ✓</span>
                )}
              </div>
            )}
          </div>

          {/* Progress bar (Production only) */}
          {isProduction && progress && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">{progress.filled} / {progress.total} fields complete</span>
                {!allComplete && (
                  <span className="text-xs text-amber-600">{progress.total - progress.filled} remaining</span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${Math.round((progress.filled / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
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
              onChange={(e) => handleNameChange(e.target.value)}
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
                onChange={(val) => handleAnswerChange(q.id, val)}
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
            disabled={submitting || (isProduction && !allComplete)}
            className={`w-full py-3 text-base rounded-xl font-semibold transition ${
              isProduction && !allComplete
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "btn-primary"
            }`}
          >
            {submitting
              ? "Submitting…"
              : isProduction && !allComplete
              ? `${progress!.total - progress!.filled} field${progress!.total - progress!.filled !== 1 ? "s" : ""} still needed`
              : isProduction
              ? "Submit batch record"
              : "Submit checklist"}
          </button>

          {isProduction && (
            <p className="text-center text-xs text-gray-400">
              Progress is saved automatically — you can close and reopen this page at any time.
            </p>
          )}

          <p className="text-center text-xs text-gray-400 pb-8">
            Yep Kitchen · SALSA Compliance Portal
          </p>
        </div>
      </form>
    </div>
  );
}
