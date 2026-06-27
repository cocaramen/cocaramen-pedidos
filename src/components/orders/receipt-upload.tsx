"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, ExternalLink, Receipt } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image-compress";
import {
  uploadTransferReceipt,
  clearTransferReceipt,
  getReceiptUrl,
} from "@/server/actions/receipts";

interface Props {
  orderId: string;
  /** Whether the order already has a receipt (the viewable URL is fetched lazily). */
  hasReceipt: boolean;
}

export function ReceiptUpload({ orderId, hasReceipt }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(hasReceipt);
  const fileRef = useRef<HTMLInputElement>(null);

  // Resolve the signed URL on the client so a slow Storage call never blocks
  // the page render.
  useEffect(() => {
    let alive = true;
    if (!hasReceipt) {
      setReceiptUrl(null);
      setLoadingUrl(false);
      return;
    }
    setLoadingUrl(true);
    getReceiptUrl(orderId)
      .then((url) => {
        if (alive) setReceiptUrl(url);
      })
      .finally(() => {
        if (alive) setLoadingUrl(false);
      });
    return () => {
      alive = false;
    };
  }, [orderId, hasReceipt]);

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
        setReceiptUrl(dataUrl); // instant preview; server reconciles on refresh
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
        setReceiptUrl(null);
        toast.success("Comprobante eliminado");
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  const showImage = Boolean(receiptUrl);
  const showMissing = hasReceipt && !receiptUrl && !loadingUrl;

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
        {loadingUrl ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando comprobante…
          </p>
        ) : showImage ? (
          <a href={receiptUrl!} target="_blank" rel="noopener noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptUrl!}
              alt="Comprobante"
              className="max-h-64 w-auto rounded-md border"
            />
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
              <ExternalLink className="h-3 w-3" /> Ver en grande
            </span>
          </a>
        ) : showMissing ? (
          <p className="text-sm text-muted-foreground">
            No se pudo cargar la vista previa. Reintentá o subí el comprobante de nuevo.
          </p>
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
