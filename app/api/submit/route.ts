import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { checklist_id, submitted_by, answers } = body;

  if (!checklist_id || !submitted_by || !Array.isArray(answers)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const db = createServerClient();

  // Create submission
  const { data: submission, error: subErr } = await db
    .from("submissions")
    .insert({
      checklist_id,
      submitted_by,
      signed_off_by: null,
      signed_off_at: null,
      notes: null,
    })
    .select("id")
    .single();

  if (subErr || !submission) {
    console.error("Submission insert error:", subErr);
    return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
  }

  // Insert answers
  const answerRows = (answers as { question_id: string; value: string | null }[]).map((a) => ({
    submission_id: submission.id,
    question_id: a.question_id,
    value: a.value,
  }));

  const { error: ansErr } = await db.from("answers").insert(answerRows);

  if (ansErr) {
    console.error("Answer insert error:", ansErr);
    // Roll back submission
    await db.from("submissions").delete().eq("id", submission.id);
    return NextResponse.json({ error: "Failed to save answers" }, { status: 500 });
  }

  return NextResponse.json({ id: submission.id }, { status: 201 });
}
