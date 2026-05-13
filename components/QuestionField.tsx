"use client";

import { useRef, useCallback } from "react";
import type { Question } from "@/lib/types";

interface Props {
  question: Question;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export default function QuestionField({ question, value, onChange, error }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const base = (
    <div className="space-y-1">
      <label className="label">
        {question.label}
        {question.required && <span className="ml-1 text-brand">*</span>}
      </label>
      {question.hint && <p className="text-xs text-gray-500 -mt-0.5 mb-1">{question.hint}</p>}
    </div>
  );

  const errMsg = error ? (
    <p className="mt-1 text-xs text-red-600">{error}</p>
  ) : null;

  if (question.type === "checkbox") {
    const checked = value === "true";
    return (
      <div>
        <button
          type="button"
          onClick={() => onChange(checked ? "false" : "true")}
          className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
            checked
              ? "border-brand/40 bg-brand/5"
              : "border-gray-200 bg-white hover:border-gray-300"
          } ${error ? "border-red-300" : ""}`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
              checked ? "border-brand bg-brand text-white" : "border-gray-300"
            }`}
          >
            {checked && (
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-900">{question.label}</span>
            {question.required && <span className="ml-1 text-brand text-xs">*</span>}
            {question.hint && <p className="mt-0.5 text-xs text-gray-500">{question.hint}</p>}
          </div>
        </button>
        {errMsg}
      </div>
    );
  }

  if (question.type === "dropdown") {
    return (
      <div>
        {base}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`input ${error ? "border-red-300" : ""}`}
        >
          <option value="">Select…</option>
          {question.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {errMsg}
      </div>
    );
  }

  if (question.type === "multiple_choice") {
    const selected: string[] = value ? JSON.parse(value) : [];
    return (
      <div>
        {base}
        <div className="space-y-2">
          {question.options?.map((opt) => {
            const active = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const next = active ? selected.filter((s) => s !== opt) : [...selected, opt];
                  onChange(JSON.stringify(next));
                }}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  active ? "border-brand/40 bg-brand/5 text-brand-dark font-medium" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${active ? "border-brand bg-brand" : "border-gray-300"}`}>
                  {active && <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
        {errMsg}
      </div>
    );
  }

  if (question.type === "number") {
    return (
      <div>
        {base}
        <input
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`input ${error ? "border-red-300" : ""}`}
          placeholder="Enter number"
          inputMode="decimal"
        />
        {errMsg}
      </div>
    );
  }

  if (question.type === "date") {
    return (
      <div>
        {base}
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`input ${error ? "border-red-300" : ""}`}
        />
        {errMsg}
      </div>
    );
  }

  if (question.type === "datetime") {
    return (
      <div>
        {base}
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`input ${error ? "border-red-300" : ""}`}
        />
        {errMsg}
      </div>
    );
  }

  if (question.type === "photo") {
    const hasPhoto = value && value.startsWith("http");
    return (
      <div>
        {base}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            // Store as base64 temporarily; the submit handler will upload to Supabase
            const reader = new FileReader();
            reader.onload = () => onChange(reader.result as string);
            reader.readAsDataURL(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm transition ${
            hasPhoto
              ? "border-green-400 bg-green-50 text-green-700"
              : error
              ? "border-red-300 bg-red-50 text-red-600"
              : "border-gray-300 bg-white text-gray-500 hover:border-brand hover:text-brand"
          }`}
        >
          {value && !value.startsWith("http") ? (
            <>
              {/* preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Preview" className="h-32 w-full rounded-lg object-cover" />
              <span className="text-xs font-medium text-green-700">Photo captured — tap to retake</span>
            </>
          ) : hasPhoto ? (
            <span className="font-medium">Photo uploaded ✓</span>
          ) : (
            <>
              <CameraIcon />
              <span className="font-medium">Take photo or upload</span>
            </>
          )}
        </button>
        {errMsg}
      </div>
    );
  }

  if (question.type === "signature") {
    return <SignatureField question={question} value={value} onChange={onChange} error={error} />;
  }

  // Default: text
  return (
    <div>
      {base}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={question.label.length > 60 ? 3 : 2}
        className={`input resize-none ${error ? "border-red-300" : ""}`}
        placeholder="Enter text…"
      />
      {errMsg}
    </div>
  );
}

function SignatureField({ question, value, onChange, error }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = useCallback(() => {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const data = canvas.toDataURL("image/png");
    onChange(data);
  }, [onChange]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div>
      <label className="label">
        {question.label}
        {question.required && <span className="ml-1 text-brand">*</span>}
      </label>
      {question.hint && <p className="text-xs text-gray-500 mb-1">{question.hint}</p>}
      <div className={`rounded-xl border-2 overflow-hidden ${error ? "border-red-300" : value ? "border-brand/40" : "border-gray-200"}`}>
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="w-full touch-none bg-white cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-3 py-1.5">
          <span className="text-xs text-gray-400">Sign above</span>
          <button type="button" onClick={clear} className="text-xs text-gray-500 hover:text-red-600 transition">
            Clear
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
