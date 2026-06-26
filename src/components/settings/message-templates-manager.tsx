"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import type { OrderStatus } from "@/db/schema";
import { ORDER_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import {
  DEFAULT_TEMPLATES,
  MESSAGE_PLACEHOLDERS,
  renderTemplate,
  sampleVars,
} from "@/lib/messages";
import { saveMessageTemplate, resetMessageTemplate } from "@/server/actions/settings";

interface Props {
  templates: Record<OrderStatus, string>;
}

export function MessageTemplatesManager({ templates }: Props) {
  const sample = useMemo(() => sampleVars(), []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mensajes por estado</CardTitle>
          <CardDescription>
            Edite el mensaje que se le envía al cliente en cada estado. Use las
            variables (ej. <code className="rounded bg-muted px-1">{"{{cliente}}"}</code>);
            se completan solas con los datos del pedido. La vista previa usa datos
            de ejemplo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {MESSAGE_PLACEHOLDERS.map((p) => (
              <Badge key={p.key} variant="secondary" className="font-mono text-xs">
                {`{{${p.key}}}`}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {ORDER_STATUSES.map((status) => (
        <TemplateCard
          key={status}
          status={status}
          initialBody={templates[status]}
          sample={sample}
        />
      ))}
    </div>
  );
}

function TemplateCard({
  status,
  initialBody,
  sample,
}: {
  status: OrderStatus;
  initialBody: string;
  sample: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState(initialBody);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dirty = body !== initialBody;
  const isDefault = body === DEFAULT_TEMPLATES[status];
  const preview = renderTemplate(body, sample);

  function insertPlaceholder(key: string) {
    const el = textareaRef.current;
    const token = `{{${key}}}`;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function onSave() {
    startTransition(async () => {
      const result = await saveMessageTemplate({ status, body });
      if (result.ok) {
        toast.success(`Mensaje de "${STATUS_LABELS[status]}" guardado`);
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  function onReset() {
    startTransition(async () => {
      const result = await resetMessageTemplate(status);
      if (result.ok) {
        setBody(DEFAULT_TEMPLATES[status]);
        toast.success("Mensaje restaurado al valor por defecto");
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">{STATUS_LABELS[status]}</CardTitle>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={pending || isDefault}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={pending || !dirty}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`tpl-${status}`}>Plantilla</Label>
          <Textarea
            id={`tpl-${status}`}
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {MESSAGE_PLACEHOLDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                title={p.label}
                onClick={() => insertPlaceholder(p.key)}
                className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted"
              >
                {`{{${p.key}}}`}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Vista previa</Label>
          <div className="min-h-[12rem] whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm">
            {preview || (
              <span className="text-muted-foreground">El mensaje está vacío.</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
