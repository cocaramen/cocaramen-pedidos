import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { getBranding } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    title: `${branding.name} · ${branding.description}`,
    description: branding.description,
  };
}

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
