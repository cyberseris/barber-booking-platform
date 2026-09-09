// Shared Supabase SERVICE-ROLE client for the Vercel serverless functions.
//
// Stripe is not a logged-in user — it carries no Supabase session — so the checkout and
// webhook functions must talk to Postgres as a trusted server and write PAST RLS. That
// is what SUPABASE_SECRET_KEY (the `sb_secret_…` service-role key) is for.
//
// It is deliberately NOT `VITE_`-prefixed: Vite inlines any VITE_ var into the browser
// bundle, and a service-role key there is a full-database leak.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const SUPABASE_SECRET_KEY = process.env["SUPABASE_SECRET_KEY"];

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error(
    "Missing SUPABASE_URL (or VITE_SUPABASE_URL) / SUPABASE_SECRET_KEY in the Vercel environment.",
  );
}

/**
 * New-format Supabase keys (`sb_secret_…`, `sb_publishable_…`) are OPAQUE strings, not
 * JWTs. Sending one as `Authorization: Bearer …` makes the auth layer try to parse it as
 * a JWT and the request is rejected — the key belongs in the `apikey` header instead.
 * This mirrors the shim the browser client already uses.
 */
function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: createSupabaseFetch(SUPABASE_SECRET_KEY) },
});
