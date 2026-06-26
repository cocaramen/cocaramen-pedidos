"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, ExternalLink, Receipt } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image-compress";
import { uploadTransferReceipt, clearTransferReceipt } from "@/server/actions/receipts";

interface Props {
  orderId: string;
  /** Viewable URL of the current receipt (signed URL or data URI), or null. */
  receiptUrl: string | null;
}

export function ReceiptUpload({ orderId, receiptUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Subí una imagen (foto o captura del comprobante).");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await compressImage(file, {
        maxDim: 1280,
        quality: 0.85,
        fallbackMime: "image/jpeg",
      });
      const result = await uploadTransferReceipt(orderId, { image: dataUrl });
      if (result.ok) {
        toast.success("Comprobante adjuntado");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("No se pudo procesar la imagen.");
    } finally {
      setUploading(false);
    }
  }

  function onRemove() {
    startTransition(async () => {
      const result = await clearTransferReceipt(orderId);
      if (result.ok) {
        toast.success("Comprobante eliminado");
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  const busy = pending || uploading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4" />
          Comprobante de transferencia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {receiptUrl ? (
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptUrl}
              alt="Comprobante"
              className="max-h-64 w-auto rounded-md border"
            />
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
              <ExternalLink className="h-3 w-3" /> Ver en grande
            </span>
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todavía no se adjuntó el comprobante de esta transferencia.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {receiptUrl ? "Reemplazar" : "Subir comprobante"}
          </Button>
          {receiptUrl && (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onRemove}>
              <Trash2 className="mr-2 h-4 w-4" />
              Quitar
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickFile}
          />
        </div>
      </CardContent>
    </Card>
  );
}
