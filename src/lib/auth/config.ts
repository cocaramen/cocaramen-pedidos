export type AuthMode = "dev" | "supabase";

export function authMode(): AuthMode {
  return process.env.AUTH_MODE === "supabase" ? "supabase" : "dev";
}

export const SESSION_COOKIE = "ramen_session";

export interface AuthUser {
  id: string;
  email: string;
}

/** Parse DEV_AUTH_USERS ("email:pass,email:pass") into a map. */
export function devUsers(): Map<string, string> {
  const raw = process.env.DEV_AUTH_USERS || "operator@cocaramen.local:ramen1234";
  const map = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const idx = pair.indexOf(":");
    if (idx === -1) continue;
    const email = pair.slice(0, idx).trim().toLowerCase();
    const pass = pair.slice(idx + 1).trim();
    if (email && pass) map.set(email, pass);
  }
  return map;
}

export function devSecret(): string {
  // `||` (not `??`) so empty-string env vars fall through to the default.
  return process.env.DEV_AUTH_SECRET || "cocaramen-dev-secret-change-me";
}
