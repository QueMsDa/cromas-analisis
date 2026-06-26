"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Analisis } from "@/lib/db";

const COLOR_CALIDAD: Record<string, string> = {
  Excelente: "bg-emerald-500",
  Buena: "bg-green-500",
  Regular: "bg-yellow-500",
  Deficiente: "bg-red-500",
};

export default function HistoryPage() {
  const [analisis, setAnalisis] = useState<Analisis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setAnalisis(d.analisis ?? []))
      .catch(() => setError("No se pudo cargar el historial"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8 gap-6 max-w-2xl mx-auto">
      <header className="w-full">
        <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1 mb-4">
          ← Volver
        </Link>
        <h1 className="text-2xl font-bold text-white">Historial de análisis</h1>
        <p className="text-neutral-500 text-sm mt-1">{analisis.length} análisis guardados</p>
      </header>

      {loading && <p className="text-neutral-500 text-sm">Cargando…</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="w-full flex flex-col gap-3">
        {analisis.map((a) => (
          <div key={a.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex gap-4 items-start">
            <Image
              src={a.imagen_url}
              alt="Cromatograma"
              width={64}
              height={64}
              className="rounded-xl object-cover w-16 h-16 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white ${COLOR_CALIDAD[a.calidad] ?? "bg-neutral-600"}`}>
                  {a.calidad}
                </span>
                <span className="text-white font-bold text-sm">{a.puntaje}/10</span>
                <span className="text-neutral-500 text-xs capitalize">{a.tipo.replace("_", " ")}</span>
              </div>
              <p className="text-neutral-400 text-xs line-clamp-2">{a.resultado.observaciones}</p>
              {a.notas && <p className="text-neutral-600 text-xs mt-1 italic">{a.notas}</p>}
              <p className="text-neutral-700 text-xs mt-1">
                {new Date(a.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {!loading && analisis.length === 0 && (
          <div className="text-center py-16">
            <p className="text-neutral-500 text-sm">No hay análisis todavía.</p>
            <Link href="/" className="text-emerald-500 text-sm hover:text-emerald-400 mt-2 block">
              Analizar el primero
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
