import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { PHOTO_BUCKET, type BookableSlot } from "@/lib/shop";

export type Booking = Tables<"bookings">;
/**
 * `bookings` carries NO `start_slot_id` — a booking's slots (all N of them, including
 * the first) live in `booking_slots`, and the start time is DERIVED as MIN(starts_at)
 * over them. This view is how the UI reads that derived start/end.
 */
export type BookingWithStart = Tables<"bookings_with_start">;

/**
 * The booking lifecycle is 3 states and lives ONLY on `bookings.status`. A SLOT has no
 * status: its availability is derived from whether a `booking_slots` row references it.
 * In M1.2 `pending_payment` is the terminal state — `paid` arrives with payment later.
 */
export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending_payment: "待付款 Pending",
  paid: "已付款 Paid",
  cancelled: "已取消 Cancelled",
};

/** Public URL for a barber's portfolio image; the bucket is public-read by design. */
export function photoUrl(storagePath: string): string {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

/**
 * The run of `count` back-to-back slots starting at `startIndex`, or null if it doesn't
 * exist.
 *
 * `freeSlots` must be sorted by `starts_at` and must contain ONLY free slots (a slot is
 * free when no `booking_slots` row references it). That is what makes the contiguity
 * test sufficient: a slot held by another booking is absent from the array, so the gap
 * it leaves breaks `previous.ends_at === next.starts_at`.
 */
export function consecutiveRun(
  freeSlots: BookableSlot[],
  startIndex: number,
  count: number,
): BookableSlot[] | null {
  const run: BookableSlot[] = [];

  for (let i = startIndex; i < freeSlots.length && run.length < count; i += 1) {
    const slot = freeSlots[i];
    if (!slot) break;
    const previous = run[run.length - 1];
    if (previous && previous.ends_at !== slot.starts_at) return null;
    run.push(slot);
  }

  return run.length === count ? run : null;
}

/** Local-calendar day key (YYYY-MM-DD) for grouping slots into date tabs. */
export function localDateKey(iso: string): string {
  const date = new Date(iso);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Slots are `timestamptz`, so they render in the VIEWER's timezone — a shop in Taipei
 * publishing 18:00 shows as a different wall-clock time to a customer elsewhere. We
 * label the zone rather than silently shifting the shop's hours.
 */
export function localTimeZoneLabel(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "local time";
  }
}
