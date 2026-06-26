import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { initDB } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    await initDB();

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const tipo  = searchParams.get("tipo");
    const offset = (page - 1) * limit;

    const rows = tipo
      ? await sql`
          SELECT id, imagen_url, tipo, calidad, puntaje, resultado, notas, created_at
          FROM analisis
          WHERE tipo = ${tipo}
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT id, imagen_url, tipo, calidad, puntaje, resultado, notas, created_at
          FROM analisis
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;

    const countResult = tipo
      ? await sql`SELECT COUNT(*)::int AS total FROM analisis WHERE tipo = ${tipo}`
      : await sql`SELECT COUNT(*)::int AS total FROM analisis`;

    return NextResponse.json({
      analisis: rows.rows,
      total: countResult.rows[0].total,
      page,
      limit,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 });
  }
}
