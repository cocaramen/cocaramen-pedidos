import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-5xl font-bold text-primary">404</p>
      <div>
        <h1 className="text-xl font-semibold">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground">
          El recurso que busca no existe o fue movido.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Volver al panel</Link>
      </Button>
    </div>
  );
}
