import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@vercel/postgres";
import sharp from "sharp";
import { initDB } from "@/lib/db";
import type { ResultadoCroma } from "@/lib/db";

const SIZE = 300;

function zonStats(pixels: number[][]) {
  const n = pixels.length || 1;
  const avgR = pixels.reduce((s, p) => s + p[0], 0) / n;
  const avgG = pixels.reduce((s, p) => s + p[1], 0) / n;
  const avgB = pixels.reduce((s, p) => s + p[2], 0) / n;
  const brightness = (avgR + avgG + avgB) / 3;
  const varR = pixels.reduce((s, p) => s + (p[0] - avgR) ** 2, 0) / n;
  const varG = pixels.reduce((s, p) => s + (p[1] - avgG) ** 2, 0) / n;
  const varB = pixels.reduce((s, p) => s + (p[2] - avgB) ** 2, 0) / n;
  const variance = (varR + varG + varB) / 3;
  // Brownness: high R, moderate G, low B — typical of humic compounds
  const brownScore = ((avgR - avgB) / 255) * (avgG / 255);
  return { avgR, avgG, avgB, brightness, variance, brownScore };
}

async function analizarCromatograma(buffer: Buffer): Promise<ResultadoCroma> {
  const { data } = await sharp(buffer)
    .resize(SIZE, SIZE, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const maxR = Math.min(cx, cy);

  // Pfeiffer zones: nucleus (0–25%), inner ring (25–50%), outer ring (50–75%), periphery (75–100%)
  const nucleus: number[][] = [];
  const innerRing: number[][] = [];
  const outerRing: number[][] = [];
  const periphery: number[][] = [];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 3;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxR;
      if (dist < 0.25) nucleus.push([r, g, b]);
      else if (dist < 0.5) innerRing.push([r, g, b]);
      else if (dist < 0.75) outerRing.push([r, g, b]);
      else if (dist <= 1.0) periphery.push([r, g, b]);
    }
  }

  const nuc = zonStats(nucleus);
  const inn = zonStats(innerRing);
  const out = zonStats(outerRing);
  const per = zonStats(periphery);

  // --- MATERIA ORGÁNICA (nucleus brownness + darkness) ---
  let moScore: number;
  let moNivel: "Alto" | "Medio" | "Bajo";
  if (nuc.brownScore > 0.14 && nuc.brightness < 190) {
    moNivel = "Alto"; moScore = 3;
  } else if (nuc.brownScore > 0.07 || nuc.brightness < 220) {
    moNivel = "Medio"; moScore = 2;
  } else {
    moNivel = "Bajo"; moScore = 1;
  }

  // --- ACTIVIDAD BIOLÓGICA (inner ring color variance = textural complexity) ---
  let bioScore: number;
  let bioNivel: "Alta" | "Media" | "Baja";
  if (inn.variance > 700) {
    bioNivel = "Alta"; bioScore = 3;
  } else if (inn.variance > 250) {
    bioNivel = "Media"; bioScore = 2;
  } else {
    bioNivel = "Baja"; bioScore = 1;
  }

  // --- ESTRUCTURA DEL SUELO (smooth gradient nucleus → periphery = good structure) ---
  const gradient = Math.abs(nuc.brightness - per.brightness) / 255;
  let estructuraScore: number;
  let estructuraNivel: "Buena" | "Regular" | "Pobre";
  if (gradient > 0.28 && gradient < 0.72) {
    estructuraNivel = "Buena"; estructuraScore = 3;
  } else if (gradient > 0.12) {
    estructuraNivel = "Regular"; estructuraScore = 2;
  } else {
    estructuraNivel = "Pobre"; estructuraScore = 1;
  }

  // --- MINERALES (periphery dominant color) ---
  let minerales: string;
  const { avgR: pR, avgG: pG, avgB: pB } = per;
  if (pR > pG + 20 && pR > pB + 20) {
    minerales = "Presencia de óxidos de hierro (tonos rojizos en zona periférica)";
  } else if (Math.abs(pR - pG) < 18 && Math.abs(pG - pB) < 18 && pR < 200) {
    minerales = "Predominio de minerales arcillosos (tonos grisáceos uniformes)";
  } else if (pG > pR + 15 && pG > pB + 15) {
    minerales = "Indicios de silicatos o clorofila residual (zona periférica verdosa)";
  } else if (pR > 210 && pG > 210) {
    minerales = "Zona mineral clara con posible presencia de calcáreos o cuarzo";
  } else {
    minerales = "Composición mineral mixta con presencia de arcillas y limos";
  }

  // --- PUNTAJE (3–9 → 2–10) ---
  const rawTotal = moScore + bioScore + estructuraScore;
  const puntaje = Math.min(10, Math.max(1, Math.round(2 + ((rawTotal - 3) * 8) / 6)));

  // --- CALIDAD GENERAL ---
  let calidad_general: "Excelente" | "Buena" | "Regular" | "Deficiente";
  if (puntaje >= 8) calidad_general = "Excelente";
  else if (puntaje >= 6) calidad_general = "Buena";
  else if (puntaje >= 4) calidad_general = "Regular";
  else calidad_general = "Deficiente";

  // --- RECOMENDACIONES ---
  const recomendaciones: string[] = [];
  if (moNivel === "Bajo")
    recomendaciones.push("Incorporar compost o abono orgánico para elevar la materia orgánica");
  else if (moNivel === "Medio")
    recomendaciones.push("Mantener aplicaciones periódicas de materia orgánica para sostener el nivel actual");
  if (bioNivel === "Baja")
    recomendaciones.push("Aplicar bioinsumos o compost maduro para estimular la actividad microbiana");
  else if (bioNivel === "Media")
    recomendaciones.push("Diversificar los aportes orgánicos para enriquecer la microbiota del suelo");
  if (estructuraNivel === "Pobre")
    recomendaciones.push("Reducir el laboreo y aplicar mulch orgánico para recuperar la estructura");
  else if (estructuraNivel === "Regular")
    recomendaciones.push("Incorporar cobertura vegetal permanente para mejorar la estructura progresivamente");
  if (puntaje >= 7)
    recomendaciones.push("Mantener las prácticas actuales de manejo para sostener la calidad del suelo");

  const fallbacks = [
    "Realizar análisis periódicos para monitorear la evolución del suelo",
    "Implementar rotación de cultivos para diversificar la microbiota",
    "Evaluar el pH del suelo como complemento al cromatograma de Pfeiffer",
  ];
  for (const fb of fallbacks) {
    if (recomendaciones.length >= 3) break;
    recomendaciones.push(fb);
  }

  return {
    calidad_general,
    puntaje,
    materia_organica: {
      nivel: moNivel,
      descripcion:
        moNivel === "Alto"
          ? "Zona central oscura y bien definida con anillos marrones intensos, indicando alta concentración de humus"
          : moNivel === "Medio"
          ? "Zona central de color pardo moderado con presencia parcial de anillos orgánicos"
          : "Zona central clara o débilmente coloreada, con escasa presencia de materia orgánica húmica",
    },
    actividad_biologica: {
      nivel: bioNivel,
      descripcion:
        bioNivel === "Alta"
          ? "Patrones complejos y radios irregulares en el anillo interior indican intensa actividad microbiana"
          : bioNivel === "Media"
          ? "Textura moderada con algunos patrones de degradación biológica visibles"
          : "Patrones uniformes y simples, con escasa diversidad de texturas en la zona de degradación",
    },
    estructura_suelo: {
      nivel: estructuraNivel,
      descripcion:
        estructuraNivel === "Buena"
          ? "Gradiente de color bien definido entre zonas, con distribución equilibrada de colores"
          : estructuraNivel === "Regular"
          ? "Gradiente moderado con algunas irregularidades en la distribución de colores"
          : "Distribución de colores irregular o muy uniforme, sin gradiente claro entre zonas",
    },
    minerales,
    recomendaciones: recomendaciones.slice(0, 3),
    observaciones: `El cromatograma muestra un suelo de calidad ${calidad_general.toLowerCase()} (${puntaje}/10). Materia orgánica ${moNivel.toLowerCase()}, actividad biológica ${bioNivel.toLowerCase()} y estructura ${estructuraNivel.toLowerCase()}.`,
  };
}

export async function POST(req: NextRequest) {
  try {
    await initDB();

    const form = await req.formData();
    const file = form.get("imagen") as File | null;
    const tipo = (form.get("tipo") as string) || "suelo";
    const notas = (form.get("notas") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió imagen" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mediaType = file.type || "image/jpeg";

    const [blob, resultado] = await Promise.all([
      put(`cromas/${Date.now()}-${file.name}`, buffer, { access: "public", contentType: mediaType }),
      analizarCromatograma(buffer),
    ]);

    const rows = await sql`
      INSERT INTO analisis (imagen_url, tipo, calidad, puntaje, resultado, notas)
      VALUES (${blob.url}, ${tipo}, ${resultado.calidad_general}, ${resultado.puntaje}, ${JSON.stringify(resultado)}, ${notas})
      RETURNING id, created_at
    `;

    return NextResponse.json({
      id: rows.rows[0].id,
      imagen_url: blob.url,
      resultado,
      created_at: rows.rows[0].created_at,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
