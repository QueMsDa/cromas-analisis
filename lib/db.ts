import { sql } from "@vercel/postgres";

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS analisis (
      id         SERIAL PRIMARY KEY,
      imagen_url TEXT        NOT NULL,
      tipo       TEXT        NOT NULL DEFAULT 'suelo'
                             CHECK (tipo IN ('suelo','compost','producto_agricola','abono')),
      calidad    TEXT        NOT NULL
                             CHECK (calidad IN ('Excelente','Buena','Regular','Deficiente')),
      puntaje    INTEGER     NOT NULL
                             CHECK (puntaje BETWEEN 1 AND 10),
      resultado  JSONB       NOT NULL,
      notas      TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS analisis_created_at_idx ON analisis (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS analisis_tipo_idx ON analisis (tipo)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS analisis_puntaje_idx ON analisis (puntaje DESC)
  `;
}

export interface Analisis {
  id: number;
  imagen_url: string;
  tipo: string;
  calidad: string;
  puntaje: number;
  resultado: ResultadoCroma;
  notas: string | null;
  created_at: string;
}

export interface ResultadoCroma {
  calidad_general: string;
  puntaje: number;
  materia_organica: { nivel: string; descripcion: string };
  actividad_biologica: { nivel: string; descripcion: string };
  estructura_suelo: { nivel: string; descripcion: string };
  minerales: string;
  recomendaciones: string[];
  observaciones: string;
}
