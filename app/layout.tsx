import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Agendarober | Sua rotina, organizada",
  description: "Um espaço tranquilo para seus compromissos.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
