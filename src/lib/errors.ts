/**
 * Supabase does NOT throw `Error` instances. A failed query or RPC resolves with a
 * `PostgrestError` — a plain object `{ message, details, hint, code }` — so the usual
 * `err instanceof Error ? err.message : "…"` check is always false for a DB failure and
 * every error collapses into the same generic string. That is how a genuinely broken
 * RPC ends up looking like a vague UI problem.
 *
 * `errMessage` reads `.message` off anything that has one (PostgrestError, Error, or a
 * thrown object), and only falls back when there is nothing to show.
 */
export function errMessage(err: unknown, fallback: string): string {
  if (typeof err === "string" && err.trim().length > 0) return err;

  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
  }

  return fallback;
}
