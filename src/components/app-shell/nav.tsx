"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  Settings,
  Route,
  TrendingUp,
  Wallet,
  Boxes,
} from "lucide-react";

const ITEMS = [
  { href: "/", label: "Panel", icon: LayoutDashboard, exact: true },
  { href: "/orders", label: "Pedidos", icon: ClipboardList, exact: false },
  { href: "/orders/new", label: "Nuevo Pedido", icon: PlusCircle, exact: true },
  { href: "/routes", label: "Ruta de reparto", icon: Route, exact: true },
  { href: "/finanzas", label: "Finanzas", icon: TrendingUp, exact: true },
  { href: "/gastos", label: "Gastos", icon: Wallet, exact: false },
  { href: "/inventario", label: "Inventario", icon: Boxes, exact: false },
  { href: "/settings", label: "Configuración", icon: Settings, exact: false },
];

export function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        // Avoid /orders matching /orders/new highlight collision
        const isActive =
          item.href === "/orders"
            ? pathname === "/orders" || /^\/orders\/[^/]+/.test(pathname)
            : active;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
