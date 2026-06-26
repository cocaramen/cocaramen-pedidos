"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Link2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { OrderStatus } from "@/db/schema";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import { renderTemplate } from "@/lib/messages";
import { waMeLink } from "@/lib/whatsapp";

interface Props {
  templates: Record<OrderStatus, string>;
  vars: Record<string, string>;
  phone: string;
  currentStatus: OrderStatus;
  publicUrl: string;
}

export function OrderMessagePanel({
  templates,
  vars,
  phone,
  currentStatus,
  publicUrl,
}: Props) {
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [text, setText] = useState(() => renderTemplate(templates[currentStatus], vars));
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  async function onCopyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLinkCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  }

  function onStatusChange(next: string) {
    const s = next as OrderStatus;
    setStatus(s);
    setText(renderTemplate(templates[s], vars));
    setCopied(false);
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Mensaje copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar. Copie manualmente.");
    }
  }

  const wa = waMeLink(phone, text);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mensaje para el cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Estado del mensaje</Label>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Elegí el estado para ver/copiar ese mensaje (no cambia el estado del
            pedido). Se completa con los datos guardados; podés ajustar el texto
            antes de enviarlo (los cambios no se guardan).
          </p>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="text-sm"
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onCopy} className="flex-1">
            {copied ? (
              <Check className="mr-2 h-4 w-4 text-success" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            Copiar
          </Button>
          {wa ? (
            <Button asChild className="flex-1 bg-[#25D366] text-white hover:bg-[#1eb558]">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                Abrir en WhatsApp
              </a>
            </Button>
          ) : (
            <Button type="button" disabled className="flex-1">
              Abrir en WhatsApp
            </Button>
          )}
        </div>
        {!wa && (
          <p className="text-xs text-muted-foreground">
            El teléfono del pedido no es válido para WhatsApp.
          </p>
        )}

        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="h-4 w-4" />
            Enlace público del pedido
          </div>
          <p className="break-all text-xs text-muted-foreground">{publicUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCopyLink}>
              {linkCopied ? (
                <Check className="mr-2 h-4 w-4 text-success" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copiar enlace
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                Abrir
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
