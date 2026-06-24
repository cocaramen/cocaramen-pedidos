"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="mx-auto max-w-md">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </span>
        <div>
          <p className="font-semibold">Algo salió mal</p>
          <p className="text-sm text-muted-foreground">
            Ocurrió un error al cargar esta sección.
          </p>
        </div>
        <Button onClick={() => reset()}>Reintentar</Button>
      </CardContent>
    </Card>
  );
}
