"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ResultadoCroma } from "@/lib/db";

type Estado = "idle" | "cargando" | "listo" | "error";

const COLOR_CALIDAD: Record<string, string> = {
  Excelente: "bg-emerald-500",
  Buena: "bg-green-500",
  Regular: "bg-yellow-500",
  Deficiente: "bg-red-500",
};

const COLOR_NIVEL: Record<string, string> = {
  Alto: "text-emerald-400",
  Alta: "text-emerald-400",
  Buena: "text-emerald-400",
  Medio: "text-yellow-400",
  Media: "text-yellow-400",
  Regular: "text-yellow-400",
  Bajo: "text-red-400",
  Baja: "text-red-400",
  Pobre: "text-red-400",
};

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState("suelo");
  const [notas, setNotas] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");
  const [resultado, setResultado] = useState<ResultadoCroma | null>(null);
  const [imagenUrl, setImagenUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setEstado("idle");
    setResultado(null);
  }

  async function analizar() {
    if (!file) return;
    setEstado("cargando");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("imagen", file);
      fd.append("tipo", tipo);
      fd.append("notas", notas);
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error desconocido");
      setResultado(data.resultado);
      setImagenUrl(data.imagen_url);
      setEstado("listo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
      setEstado("error");
    }
  }

  function nuevo() {
    setPreview(null);
    setFile(null);
    setResultado(null);
    setEstado("idle");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8 gap-6 max-w-2xl mx-auto">
      <header className="w-full text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">CromaLab</h1>
        <p className="text-neutral-400 text-sm mt-1">Análisis de cromatogramas de suelo por IA</p>
        <Link href="/history" className="text-xs text-neutral-500 hover:text-neutral-300 underline mt-1 block">
          Ver historial
        </Link>
      </header>

      {!resultado && (
        <section className="w-full flex flex-col gap-4">
          <div
            className="border-2 border-dashed border-neutral-700 rounded-2xl flex flex-col items-center justify-center gap-3 p-8 cursor-pointer hover:border-neutral-500 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            {preview ? (
              <Image src={preview} alt="Prevista" width={320} height={320} className="rounded-xl object-contain max-h-64 w-auto" />
            ) : (
              <>
                <svg className="w-12 h-12 text-neutral-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-neutral-400 text-sm text-center">
                  Toca para subir foto del cromatograma<br />
                  <span className="text-neutral-600 text-xs">JPG · PNG · WEBP — cámara o galería</span>
                </p>
              </>
            )}
            <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
          </div>

          <div>
            <label className="text-xs text-neutral-500 block mb-1">Tipo de muestra</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neutral-500"
            >
              <option value="suelo">Suelo</option>
              <option value="compost">Compost</option>
              <option value="producto_agricola">Producto agrícola</option>
              <option value="abono">Abono orgánico</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-500 block mb-1">Notas adicionales (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: Parcela norte, prof. 20 cm"
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500"
            />
          </div>

          <button
            onClick={analizar}
            disabled={!file || estado === "cargando"}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-semibold transition-colors text-sm"
          >
            {estado === "cargando" ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Analizando con IA…
              </span>
            ) : "Analizar cromatograma"}
          </button>

          {estado === "error" && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
        </section>
      )}

      {resultado && (
        <section className="w-full flex flex-col gap-4">
          <div className="flex items-center gap-4">
            {imagenUrl && (
              <Image src={imagenUrl} alt="Cromatograma" width={80} height={80} className="rounded-xl object-cover w-20 h-20 flex-shrink-0" />
            )}
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold text-white ${COLOR_CALIDAD[resultado.calidad_general] ?? "bg-neutral-600"}`}>
                {resultado.calidad_general}
              </span>
              <p className="text-white font-bold text-3xl mt-1">
                {resultado.puntaje}<span className="text-neutral-500 text-base font-normal">/10</span>
              </p>
            </div>
          </div>

          <div className="w-full bg-neutral-800 rounded-full h-2">
            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${resultado.puntaje * 10}%` }} />
          </div>

          <p className="text-neutral-300 text-sm leading-relaxed">{resultado.observaciones}</p>

          <div className="grid grid-cols-1 gap-3">
            {(
              [
                { label: "Materia orgánica", data: resultado.materia_organica },
                { label: "Actividad biológica", data: resultado.actividad_biologica },
                { label: "Estructura del suelo", data: resultado.estructura_suelo },
              ] as const
            ).map(({ label, data }) => (
              <div key={label} className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-neutral-500 uppercase tracking-wider">{label}</span>
                  <span className={`text-sm font-bold ${COLOR_NIVEL[data.nivel] ?? "text-neutral-300"}`}>{data.nivel}</span>
                </div>
                <p className="text-neutral-300 text-xs leading-relaxed">{data.descripcion}</p>
              </div>
            ))}

            <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
              <span className="text-xs text-neutral-500 uppercase tracking-wider block mb-1">Minerales</span>
              <p className="text-neutral-300 text-xs leading-relaxed">{resultado.minerales}</p>
            </div>
          </div>

          <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
            <span className="text-xs text-neutral-500 uppercase tracking-wider block mb-2">Recomendaciones</span>
            <ul className="flex flex-col gap-2">
              {resultado.recomendaciones.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-neutral-300">
                  <span className="text-emerald-500 font-bold flex-shrink-0">{i + 1}.</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={nuevo}
            className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-sm transition-colors"
          >
            Analizar otro cromatograma
          </button>
        </section>
      )}
    </main>
  );
}
