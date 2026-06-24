"use server";

import { cookies } from "next/headers";
import { createHash } from "crypto";
import { authMode, devUsers, SESSION_COOKIE, type AuthUser } from "@/lib/auth/config";
import { createDevToken } from "@/lib/auth/dev-token";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";

export async function signIn(
  email: string,
  password: string,
): Promise<ActionResult<{ email: string }>> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) return fail("Ingrese correo y contraseña.");

  if (authMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) return fail("Credenciales inválidas.");
    return ok({ email: cleanEmail });
  }

  // Dev mode
  const expected = devUsers().get(cleanEmail);
  if (!expected || expected !== password) {
    return fail("Credenciales inválidas.");
  }
  const user: AuthUser = {
    id: createHash("sha256").update(cleanEmail).digest("hex").slice(0, 32),
    email: cleanEmail,
  };
  const store = await cookies();
  store.set(SESSION_COOKIE, createDevToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return ok({ email: cleanEmail });
}

export async function signOut(): Promise<void> {
  if (authMode() === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
