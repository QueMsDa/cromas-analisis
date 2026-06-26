import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "CromaLab — Análisis de Cromatogramas de Suelo",
  description: "Sube una foto de tu cromatograma de papel Pfeiffer y obtén un diagnóstico de salud del suelo con inteligencia artificial.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full`}>
      <body className="min-h-full bg-neutral-950 text-neutral-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
