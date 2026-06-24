import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authMode, SESSION_COOKIE, type AuthUser } from "./config";
import { verifyDevToken } from "./dev-token";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Returns the current authenticated user, or null. Never throws. */
export async function getUser(): Promise<AuthUser | null> {
  if (authMode() === "supabase") {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user ? { id: user.id, email: user.email ?? "" } : null;
    } catch {
      return null;
    }
  }

  const store = await cookies();
  return verifyDevToken(store.get(SESSION_COOKIE)?.value);
}

/** Returns the user or redirects to /login. Use in protected pages/actions. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
