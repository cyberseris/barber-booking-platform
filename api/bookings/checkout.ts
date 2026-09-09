// POST /api/bookings/checkout — turn a `pending_payment` booking into a Stripe Checkout Session.
//
// The dialog has already created the booking (M1.2's create_booking RPC, one transaction:
// booking + its N booking_slots + a PRICE SNAPSHOT). This route reads that snapshot
// SERVER-SIDE and builds a dynamic price_data session. It never trusts a price from the client.
import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
// NOTE the .js ESM extension: "type": "module" + Vercel transpiling each api/*.ts separately
// means a bare '../_supabaseAdmin' 500s at runtime with ERR_MODULE_NOT_FOUND.
import { supabaseAdmin } from "../_supabaseAdmin.js";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] as string);

/**
 * Stripe's TRUE zero-decimal currencies. Everything else — TWD included — is 2-decimal in
 * Stripe, so unit_amount = price * 100 (NT$300 → 30000 = NT$300.00).
 *
 * Do NOT drive this off platform_settings.currency_minor_units: that column is a DISPLAY
 * concept ("show whole TWD"), which is a different thing from Stripe's per-currency
 * exponent. Treating TWD as zero-decimal sends 300 = NT$3.00 ≈ US$0.10, which is below
 * Stripe's ~US$0.50 minimum — the Session is REJECTED and the customer never reaches
 * the payment page.
 */
const ZERO_DECIMAL = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

interface BookingRow {
  id: string;
  customer_id: string;
  status: string;
  price: number;
  services: {
    name: string;
    barber_id: string;
    barbers: { id: string; name: string } | null;
  } | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) ?? {};
  const bookingId = body.booking_id as string | undefined;
  if (!bookingId) return res.status(400).json({ error: "missing booking_id" });

  // bookings has NO barber_id and NO start_slot_id — the barber is reached through the
  // SERVICE (bookings.service_id → services.barber_id → barbers). The slots live in
  // booking_slots and aren't needed here.
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_id, status, price, services(name, barber_id, barbers(id, name))")
    .eq("id", bookingId)
    .single();

  if (error || !data) return res.status(404).json({ error: "booking not found" });

  const booking = data as unknown as BookingRow;
  if (booking.status !== "pending_payment") {
    return res.status(400).json({ error: "booking not payable" });
  }

  const service = booking.services;
  const barberId = service?.barber_id;
  const barberName = service?.barbers?.name ?? "";
  if (!service || !barberId) {
    return res.status(500).json({ error: "booking is missing its service/barber" });
  }

  // Currency comes from platform_settings (created in M1.1) — never hard-coded.
  const { data: cfg } = await supabaseAdmin.from("platform_settings").select("currency").single();

  const currency = (cfg?.currency ?? "twd").toLowerCase();
  const factor = ZERO_DECIMAL.has(currency) ? 1 : 100;
  const unitAmount = Math.round(booking.price * factor);

  const origin =
    (req.headers.origin as string | undefined) ??
    (req.headers.host ? `https://${req.headers.host}` : "");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `${service.name} @ ${barberName}` },
            unit_amount: unitAmount, // NT$300 → 30000 (NT$300.00), NOT 300 (NT$3.00 → rejected)
          },
          quantity: 1,
        },
      ],
      // booking_id is the ONLY join key the webhook needs, and OUR server set it —
      // the customer cannot forge it. Never look a booking up by email/customer.
      metadata: { booking_id: booking.id, customer_id: booking.customer_id },
      client_reference_id: booking.id,
      // The success page polls THE BOOKING, and nothing on the booking maps a Stripe
      // session_id back to a booking_id — so booking_id must travel in the URL.
      // session_id is along only for display/debugging.
      success_url: `${origin}/bookings/success?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/barbers/${barberId}`,
    });

    return res.status(200).json({ url: session.url });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "could not create checkout session";
    return res.status(502).json({ error: message });
  }
}
