"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Loader2 } from "lucide-react";
import { STATUS_LABELS, ORDER_STATUSES } from "@/lib/order-status";
import type { DeliverySlot } from "@/db/schema";

const ALL = "__all__";

export function OrdersFilters({ slots }: { slots: DeliverySlot[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState(params.get("search") ?? "");

  function apply(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === ALL) sp.delete(key);
      else sp.set(key, value);
    }
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("search") ?? "") !== search) {
        apply({ search: search || undefined });
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters =
    Boolean(params.get("search")) ||
    Boolean(params.get("date")) ||
    Boolean(params.get("slotId")) ||
    Boolean(params.get("status"));

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, dirección o teléfono…"
          className="pl-9"
        />
        {pending && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <Input
        type="date"
        value={params.get("date") ?? ""}
        onChange={(e) => apply({ date: e.target.value || undefined })}
        className="w-auto"
      />

      <Select
        value={params.get("slotId") ?? ALL}
        onValueChange={(v) => apply({ slotId: v })}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Franja" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas las franjas</SelectItem>
          {slots.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("status") ?? ALL}
        onValueChange={(v) => apply({ status: v })}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos los estados</SelectItem>
          {ORDER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get("sort") ?? "date_desc"}
        onValueChange={(v) => apply({ sort: v === "date_desc" ? undefined : v })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date_desc">Fecha (recientes)</SelectItem>
          <SelectItem value="date_asc">Fecha (próximas)</SelectItem>
          <SelectItem value="created_desc">Creación (recientes)</SelectItem>
          <SelectItem value="bowls_desc">Más tazones</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch("");
            startTransition(() => router.push(pathname));
          }}
        >
          <X className="mr-1 h-4 w-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
