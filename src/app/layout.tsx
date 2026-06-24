import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Cocaramen · Gestión de Pedidos",
  description: "Sistema interno de gestión de pedidos de ramen",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-muted/30 antialiased">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
