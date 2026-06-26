import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { initDB } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await initDB();
    const { id } = await params;
    const rows = await sql`
      SELECT id, imagen_url, tipo, calidad, puntaje, resultado, notas, created_at
      FROM analisis
      WHERE id = ${parseInt(id, 10)}
    `;
    if (rows.rowCount === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json(rows.rows[0]);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await initDB();
    const { id } = await params;
    const result = await sql`
      DELETE FROM analisis
      WHERE id = ${parseInt(id, 10)}
      RETURNING id
    `;
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    return NextResponse.json({ deleted: result.rows[0].id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
