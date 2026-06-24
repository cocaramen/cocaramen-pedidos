import { config } from "dotenv";
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

/**
 * Creates (or updates the password of) the internal operator users in Supabase
 * Auth, using the admin API. Idempotent. Users are created already-confirmed.
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   AUTH_USERS  ("email:password,email:password")  — falls back to DEV_AUTH_USERS
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   AUTH_USERS="operator@x.com:secret,chef@x.com:secret" \
 *   npx tsx scripts/create-supabase-users.ts
 */
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const raw = process.env.AUTH_USERS || process.env.DEV_AUTH_USERS;

  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  if (!raw) throw new Error("Set AUTH_USERS=\"email:pass,email:pass\".");

  const users = raw
    .split(",")
    .map((pair) => {
      const i = pair.indexOf(":");
      return { email: pair.slice(0, i).trim().toLowerCase(), password: pair.slice(i + 1).trim() };
    })
    .filter((u) => u.email && u.password);

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const u of users) {
    // Try to find an existing user by listing (small user base).
    const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users.find((x) => x.email?.toLowerCase() === u.email);

    if (existing) {
      await supabase.auth.admin.updateUserById(existing.id, {
        password: u.password,
        email_confirm: true,
      });
      console.log(`  • updated ${u.email}`);
    } else {
      const { error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
      });
      if (error) {
        console.error(`  ✗ ${u.email}: ${error.message}`);
      } else {
        console.log(`  • created ${u.email}`);
      }
    }
  }
  console.log("✅ Supabase users ready.");
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
