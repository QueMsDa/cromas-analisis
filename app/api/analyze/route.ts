import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@vercel/postgres";
import Anthropic from "@anthropic-ai/sdk";
import { initDB } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un experto en cromatografía de papel de Pfeiffer para análisis de suelos y productos agrícolas.
Analiza la imagen del cromatograma y devuelve ÚNICAMENTE un objeto JSON con esta estructura exacta, sin texto adicional:
{
  "calidad_general": "Excelente|Buena|Regular|Deficiente",
  "puntaje": <número entero del 1 al 10>,
  "materia_organica": {
    "nivel": "Alto|Medio|Bajo",
    "descripcion": "<observación concisa sobre la zona central y los anillos marrones>"
  },
  "actividad_biologica": {
    "nivel": "Alta|Media|Baja",
    "descripcion": "<observación sobre las texturas, radios y patrones de degradación>"
  },
  "estructura_suelo": {
    "nivel": "Buena|Regular|Pobre",
    "descripcion": "<observación sobre la distribución de colores y gradientes>"
  },
  "minerales": "<descripción de los colores periféricos y zonas minerales>",
  "recomendaciones": ["<recomendación 1>", "<recomendación 2>", "<recomendación 3>"],
  "observaciones": "<resumen diagnóstico de 2-3 oraciones>"
}

Basa tu análisis en los patrones de color, la nitidez de los anillos, la extensión de las zonas y la simetría del cromatograma.`;

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
    const base64 = buffer.toString("base64");
    const mediaType = (file.type as "image/jpeg" | "image/png" | "image/webp") || "image/jpeg";

    const blob = await put(`cromas/${Date.now()}-${file.name}`, buffer, {
      access: "public",
      contentType: mediaType,
    });

    const message = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `Analiza este cromatograma de ${tipo}${notas ? `. Notas adicionales: ${notas}` : ""}. Responde solo con el JSON.`,
            },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    const rawText = textBlock && "text" in textBlock ? textBlock.text : "";

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No se pudo parsear la respuesta de Claude" }, { status: 500 });
    }

    let resultado;
    try {
      resultado = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "JSON inválido en la respuesta de Claude" }, { status: 500 });
    }

    // Ensure puntaje is within valid DB range
    resultado.puntaje = Math.min(10, Math.max(1, Math.round(Number(resultado.puntaje) || 5)));

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
