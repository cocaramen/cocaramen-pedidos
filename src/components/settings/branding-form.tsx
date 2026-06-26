"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload, Trash2 } from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Branding } from "@/server/settings";
import {
  updateBranding,
  updateBrandingLogo,
  clearBrandingLogo,
} from "@/server/actions/settings";
import { compressImage } from "@/lib/image-compress";

export function BrandingForm({ branding }: { branding: Branding }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(branding.name);
  const [nameShort, setNameShort] = useState(branding.nameShort);
  const [description, setDescription] = useState(branding.description);
  const [logo, setLogo] = useState<string | null>(branding.logo);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function onSaveText(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      const result = await updateBranding({ name, nameShort, description });
      if (result.ok) {
        toast.success("Identidad actualizada");
        router.refresh();
        return;
      }
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.error);
    });
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seleccioná una imagen.");
      return;
    }
    setUploading(true);
    try {
      // Logo is shown small; 256px WebP is sharp on retina and tiny in size.
      const dataUrl = await compressImage(file, { maxDim: 256, quality: 0.9 });
      const result = await updateBrandingLogo({ logo: dataUrl });
      if (result.ok) {
        setLogo(dataUrl);
        toast.success("Logo actualizado");
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

  function onRemoveLogo() {
    startTransition(async () => {
      const result = await clearBrandingLogo();
      if (result.ok) {
        setLogo(null);
        toast.success("Logo restablecido al predeterminado");
        router.refresh();
        return;
      }
      toast.error(result.error);
    });
  }

  const err = (f: string) => fieldErrors[f]?.[0];
  const preview = logo ?? "/logo.png";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidad del negocio</CardTitle>
        <CardDescription>
          Nombre, descripción y logo que se muestran en el sistema, el login y la
          página pública del pedido.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo */}
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Logo"
            className="h-20 w-20 shrink-0 rounded-full border object-cover"
          />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || pending}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Subir logo
              </Button>
              {logo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading || pending}
                  onClick={onRemoveLogo}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Quitar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Imagen cuadrada (PNG/JPG). Se redimensiona automáticamente.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
            />
          </div>
        </div>

        {/* Text fields */}
        <form id="branding-text" onSubmit={onSaveText} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="b-name">Nombre</Label>
            <Input
              id="b-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Coca Ramen Delivery"
            />
            {err("name") && (
              <p className="text-sm font-medium text-destructive">{err("name")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-name-short">Nombre corto</Label>
            <Input
              id="b-name-short"
              value={nameShort}
              onChange={(e) => setNameShort(e.target.value)}
              placeholder="Coca Ramen"
            />
            <p className="text-xs text-muted-foreground">
              Para espacios reducidos (móvil, mensajes a clientes).
            </p>
            {err("nameShort") && (
              <p className="text-sm font-medium text-destructive">{err("nameShort")}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-desc">Descripción</Label>
            <Input
              id="b-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Gestión de pedidos"
            />
            {err("description") && (
              <p className="text-sm font-medium text-destructive">{err("description")}</p>
            )}
          </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="branding-text" disabled={pending || uploading}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </CardFooter>
    </Card>
  );
}
