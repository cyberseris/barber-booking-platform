// POST /api/stripe/webhook — the ONLY route that marks a booking paid.
//
// Its entire job: on checkout.session.completed with payment_status === 'paid', flip the
// BOOKING pending_payment → paid and stamp paid_at. No split is computed and no ledger row
// is written (there is no transactions table); "money in" is simply this paid booking's
// price snapshot. M2.2 computes the platform/shop split at payout-build time from the
// picked paid bookings × commission_rates.
import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_supabaseAdmin.js"; // NOTE the .js ESM extension

// REQUIRED, and NOT the Next.js `api: { bodyParser: false }` incantation — @vercel/node
// does not read that key at all. It gates its request helpers on `helpers`, and those
// helpers drain the request stream to build req.body/req.query, then replay it through a
// PassThrough that only re-routes the 'data' and 'end' events. Async-iterating such a
// request can yield ZERO bytes, and an empty buffer fails signature verification with a
// 400 every time. Turning helpers off leaves the stream pristine — at the cost of
// req.body/req.query and the res.status()/res.json() sugar, which is why the responses
// below are written with plain Node APIs.
export const config = { helpers: false };

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] as string);

/** Reply without the res helpers (disabled above). */
function reply(res: VercelResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

/**
 * Buffer the raw request bytes. Uses the 'data'/'end' EVENTS rather than `for await`:
 * events are what Vercel's body-replay path re-routes, so this reads correctly whether or
 * not the helpers ran.
 */
function rawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return reply(res, 405, { error: "method not allowed" });

  const buf = await rawBody(req); // RAW bytes — never req.body / JSON first
  const sig = req.headers["stripe-signature"] as string | undefined;
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig as string, secret as string);
  } catch (cause) {
    // Diagnostics that name the actual culprit without leaking the secret. An empty
    // rawBytes means the stream was consumed; "No signatures found" with a non-empty
    // body means the STRIPE_WEBHOOK_SECRET does not match this endpoint's signing secret.
    console.error("[stripe/webhook] signature verification failed", {
      message: cause instanceof Error ? cause.message : String(cause),
      rawBytes: buf.length,
      hasSignatureHeader: Boolean(sig),
      secretConfigured: Boolean(secret),
      secretLooksValid: secret?.startsWith("whsec_") ?? false,
    });
    return reply(res, 400, { error: "signature verification failed" });
  }

  if (event.type !== "checkout.session.completed") {
    return reply(res, 200, { received: true }); // ack unrelated events with 200
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return reply(res, 200, { received: true }); // only act on a real, paid session
  }

  const bookingId = session.metadata?.["booking_id"];
  if (!bookingId) {
    return reply(res, 400, { error: "missing booking_id metadata" }); // = our bug
  }

  // FIRST TO PAY WINS. There is no slot status to mirror: the booking already holds its N
  // slots via booking_slots (UNIQUE(slot_id) allows one live booking per slot) and the
  // browse anti-join stopped offering them the moment the pending_payment booking existed.
  //
  // IDEMPOTENCY: Stripe retries any non-2xx, and the checklist resends the event. The
  // .eq('status','pending_payment') guard IS the source of truth — a re-delivered event
  // matches ZERO rows and no-ops, so paid_at is never re-stamped. The UNIQUE index on
  // stripe_payment_intent_id is the hard backstop for a concurrent double-fire that
  // races past the status check.
  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent as string,
    })
    .eq("id", bookingId)
    .eq("status", "pending_payment");

  if (error) {
    // A duplicate-key error means another delivery already won — a no-op, not a failure.
    if (error.code === "23505") return reply(res, 200, { received: true });
    // Anything else: return non-2xx so Stripe RETRIES rather than silently acking a
    // dropped write.
    console.error("[stripe/webhook] failed to flip booking", bookingId, error);
    return reply(res, 500, { error: "could not update booking" });
  }

  console.log("[stripe/webhook] booking marked paid", bookingId);
  return reply(res, 200, { received: true });
}
