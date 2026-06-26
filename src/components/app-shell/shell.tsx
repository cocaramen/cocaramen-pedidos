"use client";

import { useState } from "react";
import Link from "next/link";
import { Nav } from "./nav";
import { UserMenu } from "./user-menu";
import { SocialLinks } from "./social-links";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import type { Branding } from "@/server/settings";

function Brand({ branding }: { branding: Branding }) {
  return (
    <Link href="/" className="flex items-center gap-2 px-5 py-5">
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={branding.logo ?? "/logo.png"}
          alt={branding.name}
          className="h-full w-full object-cover"
        />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-bold leading-snug tracking-tight">{branding.name}</div>
        <div className="text-xs text-muted-foreground">{branding.description}</div>
      </div>
    </Link>
  );
}

export function AppShell({
  email,
  branding,
  children,
}: {
  email: string;
  branding: Branding;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <Brand branding={branding} />
        <div className="flex-1 py-2">
          <Nav />
        </div>
        <div className="space-y-2 border-t p-3">
          <SocialLinks />
          <p className="text-xs text-muted-foreground">Sistema interno · 2 operadores</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between">
              <Brand branding={branding} />
              <Button
                variant="ghost"
                size="icon"
                className="mr-2"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 py-2" onClick={() => setOpen(false)}>
              <Nav />
            </div>
            <div className="border-t p-3">
              <SocialLinks />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur sm:px-6",
          )}
        >
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="truncate font-semibold lg:hidden">{branding.nameShort}</span>
          </div>
          <UserMenu email={email} />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
