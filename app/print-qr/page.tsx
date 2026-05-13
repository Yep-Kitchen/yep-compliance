"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Checklist } from "@/lib/types";
import { frequencyLabel } from "@/lib/utils";
import QRCode from "qrcode";
import Link from "next/link";

// useSearchParams must be inside a Suspense boundary in Next.js 15+
export default function PrintQRPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-sm text-gray-500">Loading…</div>}>
      <PrintQRContent />
    </Suspense>
  );
}

function PrintQRContent() {
  const searchParams = useSearchParams();
  const filterId = searchParams.get("id");

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "https://yep-compliance.vercel.app";

  useEffect(() => {
    async function load() {
      let query = supabase.from("checklists").select("*").eq("active", true).order("name");
      if (filterId) query = query.eq("id", filterId);
      const { data } = await query;
      if (data) setChecklists(data);
      setLoading(false);
    }
    load();
  }, [filterId]);

  return (
    <div className="min-h-screen bg-white">
      {/* Print toolbar — hidden when printing */}
      <div className="print:hidden border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between sticky top-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="btn-ghost text-xs px-2">← Dashboard</Link>
          <span className="text-sm font-semibold text-gray-900">
            {filterId ? "QR Code" : "All QR Codes"}
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="btn-primary"
        >
          Print / Save PDF
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="p-8 grid grid-cols-2 gap-8 print:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {checklists.map((cl) => (
            <QRCard key={cl.id} checklist={cl} baseUrl={appUrl} />
          ))}
        </div>
      )}
    </div>
  );
}

function QRCard({ checklist, baseUrl }: { checklist: Checklist; baseUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = `${baseUrl}/checklist/${checklist.id}`;

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 200,
        margin: 2,
        color: { dark: "#111827", light: "#ffffff" },
      });
    }
  }, [url]);

  return (
    <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:shadow-none print:border-gray-300">
      {/* Yep Kitchen branding */}
      <div className="mb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Yep Kitchen" className="h-8 w-auto mx-auto" />
      </div>

      {/* QR */}
      <canvas ref={canvasRef} className="rounded-lg" />

      {/* Name */}
      <p className="mt-3 text-center text-sm font-bold text-gray-900 leading-tight">{checklist.name}</p>
      <p className="mt-0.5 text-center text-xs text-gray-500">{frequencyLabel(checklist.frequency as never)}</p>

      {/* URL hint */}
      <p className="mt-2 text-center text-[10px] text-gray-400 break-all leading-tight">{url}</p>
    </div>
  );
}
