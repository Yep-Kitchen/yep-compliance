"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Ingredient, IngredientLot } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type IngredientWithLots = Ingredient & { lots: IngredientLot[] };

export default function StockPage() {
  const [ingredients, setIngredients] = useState<IngredientWithLots[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      const { data: lots } = await supabase
        .from("ingredient_lots")
        .select("*, ingredient:ingredients(*)")
        .order("julian_code");

      const { data: ings } = await supabase
        .from("ingredients")
        .select("*")
        .order("name");

      if (ings && lots) {
        const lotsByIngredient: Record<string, IngredientLot[]> = {};
        for (const lot of lots as (IngredientLot & { ingredient: Ingredient })[]) {
          const id = lot.ingredient_id;
          if (!lotsByIngredient[id]) lotsByIngredient[id] = [];
          lotsByIngredient[id].push(lot);
        }
        setIngredients(
          (ings as Ingredient[]).map((ing) => ({
            ...ing,
            lots: lotsByIngredient[ing.id] ?? [],
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const totalStock = ingredients.reduce(
    (sum, ing) => sum + ing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0),
    0
  );

  const lowStock = ingredients.filter((ing) => {
    const total = ing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0);
    return ing.lots.length > 0 && total === 0;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="btn-ghost text-xs px-2">← Dashboard</Link>
            <h1 className="text-base font-semibold text-gray-900">Stock Levels</h1>
          </div>
          <Link href="/admin/goods-in" className="btn-primary text-xs">Log Delivery</Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ingredients tracked</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{ingredients.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total stock (kg)</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{(totalStock / 1000).toFixed(1)}</p>
          </div>
          <div className={`card p-4 ${lowStock.length > 0 ? "border-red-200 bg-red-50" : ""}`}>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Out of stock</p>
            <p className={`mt-1 text-2xl font-bold ${lowStock.length > 0 ? "text-red-700" : "text-gray-900"}`}>{lowStock.length}</p>
          </div>
        </div>

        {/* Ingredient stock table */}
        {loading ? (
          <div className="card p-8 text-center text-sm text-gray-500">Loading…</div>
        ) : (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">All ingredients</h2>
              <span className="text-xs text-gray-500">Click a row to see open lots</span>
            </div>
            <div className="divide-y divide-gray-100">
              {ingredients.map((ing) => {
                const totalRemaining = ing.lots.reduce((s, l) => s + l.quantity_remaining_g, 0);
                const openLots = ing.lots.filter((l) => l.quantity_remaining_g > 0);
                const isOpen = expanded[ing.id];
                const hasStock = totalRemaining > 0;
                const noLots = ing.lots.length === 0;

                return (
                  <div key={ing.id}>
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [ing.id]: !p[ing.id] }))}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{ing.name}</p>
                        <p className="text-xs text-gray-500">
                          {noLots ? "No deliveries logged" : `${openLots.length} open lot${openLots.length !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold tabular-nums ${!hasStock && !noLots ? "text-red-600" : "text-gray-900"}`}>
                          {noLots ? "—" : `${totalRemaining.toLocaleString()}g`}
                        </p>
                        {!noLots && (
                          <p className="text-xs text-gray-400">{(totalRemaining / 1000).toFixed(2)} kg</p>
                        )}
                      </div>
                      {!noLots && (
                        <svg className={`h-4 w-4 text-gray-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
                          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    {isOpen && ing.lots.length > 0 && (
                      <div className="bg-gray-50 border-t border-gray-100 px-4 py-2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left py-1 font-medium">Julian code</th>
                              <th className="text-right py-1 font-medium">Received (g)</th>
                              <th className="text-right py-1 font-medium">Remaining (g)</th>
                              <th className="text-left py-1 font-medium pl-4">Date in</th>
                              <th className="text-left py-1 font-medium">Supplier</th>
                              <th className="text-left py-1 font-medium">Best before</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {ing.lots.map((lot) => (
                              <tr key={lot.id} className={lot.quantity_remaining_g === 0 ? "opacity-40" : ""}>
                                <td className="py-1.5 font-mono font-semibold text-gray-900">{lot.julian_code}</td>
                                <td className="py-1.5 text-right tabular-nums text-gray-600">{lot.quantity_received_g.toLocaleString()}</td>
                                <td className="py-1.5 text-right tabular-nums font-semibold text-gray-900">{lot.quantity_remaining_g.toLocaleString()}</td>
                                <td className="py-1.5 pl-4 text-gray-500">{formatDate(lot.received_date)}</td>
                                <td className="py-1.5 text-gray-500">{lot.supplier ?? "—"}</td>
                                <td className="py-1.5 text-gray-500">{lot.best_before_date ? formatDate(lot.best_before_date) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
