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

// REQUIRED: a Vercel Node function auto-parses the body, and any parse + re-serialize
// breaks the HMAC. We need the RAW bytes for signature verification.
export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] as string);

// Buffer the raw request stream ourselves — App Router's `await req.text()` does not exist here.
async function rawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const buf = await rawBody(req); // RAW bytes — never req.body / JSON first
  const sig = req.headers["stripe-signature"] as string | undefined;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig as string,
      process.env["STRIPE_WEBHOOK_SECRET"] as string,
    );
  } catch {
    return res.status(400).json({ error: "signature verification failed" });
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true }); // ack unrelated events with 200
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return res.status(200).json({ received: true }); // only act on a real, paid session
  }

  const bookingId = session.metadata?.["booking_id"];
  if (!bookingId) {
    return res.status(400).json({ error: "missing booking_id metadata" }); // = our bug
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
    // Return non-2xx so Stripe RETRIES — a dropped write must not be silently acked.
    // (A duplicate-key error here means another delivery already won; that is a no-op,
    // not a failure, so it is acked as success.)
    if (error.code === "23505") return res.status(200).json({ received: true });
    console.error("[stripe/webhook] failed to flip booking", bookingId, error);
    return res.status(500).json({ error: "could not update booking" });
  }

  return res.status(200).json({ received: true });
}
