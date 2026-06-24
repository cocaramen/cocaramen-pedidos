import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { authMode, devUsers } from "@/lib/auth/config";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import { APP_NAME } from "@/lib/app";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/");

  const isDev = authMode() === "dev";
  const firstDevUser = isDev ? [...devUsers().keys()][0] : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="relative h-24 w-24 overflow-hidden rounded-full shadow-md">
            <Image src="/logo.png" alt={APP_NAME} fill sizes="96px" className="object-cover" priority />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="text-sm text-muted-foreground">Gestión interna de pedidos</p>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>Acceso exclusivo para operadores.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm hint={firstDevUser} />
            {isDev && (
              <p className="mt-4 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                <strong>Modo desarrollo.</strong> Use las credenciales de{" "}
                <code>DEV_AUTH_USERS</code>. Por defecto:{" "}
                <code>operator@cocaramen.local</code> / <code>ramen1234</code>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
