import "server-only";
import { db } from "@/db";
import { rateLimitHits } from "@/db/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";

/**
 * DB-backed fixed-window rate limit (works across serverless instances, no
 * external service). Returns true if the action is allowed and records a hit;
 * false if the bucket is over the limit within the window.
 */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowSeconds * 1000);

  // Drop this bucket's expired rows so the table stays small.
  await db
    .delete(rateLimitHits)
    .where(and(eq(rateLimitHits.bucket, bucket), lt(rateLimitHits.createdAt, since)));

  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.bucket, bucket), gte(rateLimitHits.createdAt, since)));

  if ((row?.c ?? 0) >= limit) return false;

  await db.insert(rateLimitHits).values({ bucket });
  return true;
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
