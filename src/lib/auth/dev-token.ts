import { createHmac, timingSafeEqual } from "crypto";
import { devSecret, type AuthUser } from "./config";

/**
 * Minimal signed-token implementation for AUTH_MODE=dev. Format:
 *   base64url(JSON payload) + "." + hex(HMAC-SHA256(payload))
 * This is NOT meant for hostile production environments — it exists so the
 * app is fully usable locally with only Docker (no cloud Supabase needed).
 */

interface Payload extends AuthUser {
  iat: number;
}

const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function sign(data: string): string {
  return createHmac("sha256", devSecret()).update(data).digest("hex");
}

export function createDevToken(user: AuthUser): string {
  const payload: Payload = { ...user, iat: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyDevToken(token: string | undefined): AuthUser | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (Date.now() - payload.iat > MAX_AGE_MS) return null;
    return { id: payload.id, email: payload.email };
  } catch {
    return null;
  }
}
