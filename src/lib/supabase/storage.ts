import "server-only";
import { createClient } from "@supabase/supabase-js";

/** True when Supabase Storage can be used (URL + service-role key present). */
export function storageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function ensureBucket(name: string, isPublic: boolean) {
  const s = admin();
  const { data } = await s.storage.getBucket(name);
  if (!data) {
    // Ignore "already exists" races.
    await s.storage.createBucket(name, { public: isPublic }).catch(() => {});
  }
}

/** Decode a `data:image/...;base64,...` URI into bytes + content type. */
export function parseDataUri(uri: string): { contentType: string; bytes: Buffer } | null {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(uri);
  if (!m) return null;
  return { contentType: m[1], bytes: Buffer.from(m[2], "base64") };
}

/** Upload bytes to a PUBLIC bucket and return the public URL. */
export async function uploadPublicImage(opts: {
  bucket: string;
  path: string;
  bytes: Buffer;
  contentType: string;
}): Promise<string> {
  const s = admin();
  await ensureBucket(opts.bucket, true);
  const { error } = await s.storage
    .from(opts.bucket)
    .upload(opts.path, opts.bytes, { contentType: opts.contentType, upsert: true });
  if (error) throw error;
  return s.storage.from(opts.bucket).getPublicUrl(opts.path).data.publicUrl;
}

/** Upload bytes to a PRIVATE bucket (read only via signed URLs). */
export async function uploadPrivateImage(opts: {
  bucket: string;
  path: string;
  bytes: Buffer;
  contentType: string;
}): Promise<void> {
  const s = admin();
  await ensureBucket(opts.bucket, false);
  const { error } = await s.storage
    .from(opts.bucket)
    .upload(opts.path, opts.bytes, { contentType: opts.contentType, upsert: true });
  if (error) throw error;
}

/** Short-lived signed URL to view a private object (default 5 min). */
export async function signedUrl(
  bucket: string,
  path: string,
  expiresSec = 300,
): Promise<string | null> {
  try {
    const { data } = await admin().storage.from(bucket).createSignedUrl(path, expiresSec);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/** Best-effort delete (used to clean up the previous logo). */
export async function removeFromBucket(bucket: string, path: string): Promise<void> {
  try {
    await admin().storage.from(bucket).remove([path]);
  } catch {
    /* ignore */
  }
}

/** If `url` points to an object in our public bucket, return its storage path. */
export function publicUrlToPath(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}
