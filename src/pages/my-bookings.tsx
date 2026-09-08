import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { BrowseNav } from "@/components/browse-nav";
import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/integrations/supabase/client";
import {
  BOOKING_STATUS_LABELS,
  formatDay,
  formatTime,
  localTimeZoneLabel,
  type BookingWithStart,
} from "@/lib/booking";
import { errMessage } from "@/lib/errors";
import {
  DEFAULT_PLATFORM_CONFIG,
  formatMoney,
  type PlatformConfig,
  type Service,
} from "@/lib/shop";

interface BookingRow {
  booking: BookingWithStart;
  service: Service | null;
  barberName: string | null;
}

/**
 * The customer's own bookings.
 *
 * Rows come from the `bookings_with_start` view because `bookings` has no
 * `start_slot_id` — the start/end times are derived as MIN/MAX over the booking's
 * `booking_slots`. The view is `security_invoker`, so the own-rows RLS still applies:
 * a customer sees only their own bookings, enforced by the database, not by this filter.
 */
export default function MyBookings() {
  usePageMeta({
    title: "我的預約 — Barberly",
    description: "Your Barberly bookings.",
    ogTitle: "我的預約 — Barberly",
    ogDescription: "Your Barberly bookings.",
  });

  const [rows, setRows] = useState<BookingRow[]>([]);
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [bookingsResult, settingsResult] = await Promise.all([
      supabase
        .from("bookings_with_start")
        .select("*")
        .order("starts_at", { ascending: false, nullsFirst: false }),
      supabase.from("platform_settings").select("*").maybeSingle(),
    ]);

    if (bookingsResult.error) {
      setError(errMessage(bookingsResult.error, "Could not load your bookings."));
      setLoading(false);
      return;
    }

    if (settingsResult.data) {
      setConfig({
        currency: settingsResult.data.currency,
        currencyMinorUnits: settingsResult.data.currency_minor_units,
        slotMinutes: settingsResult.data.slot_minutes,
      });
    }

    const bookings = bookingsResult.data ?? [];
    const serviceIds = [
      ...new Set(
        bookings
          .map((booking) => booking.service_id)
          .filter((id): id is string => typeof id === "string"),
      ),
    ];

    // The barber is reached THROUGH the service — bookings has no barber_id.
    const services =
      serviceIds.length > 0
        ? ((await supabase.from("services").select("*").in("id", serviceIds)).data ?? [])
        : [];
    const barberIds = [...new Set(services.map((service) => service.barber_id))];
    const barbers =
      barberIds.length > 0
        ? ((await supabase.from("barbers").select("id, name").in("id", barberIds)).data ?? [])
        : [];

    setRows(
      bookings.map((booking) => {
        const service = services.find((candidate) => candidate.id === booking.service_id) ?? null;
        const barber = service
          ? (barbers.find((candidate) => candidate.id === service.barber_id) ?? null)
          : null;
        return { booking, service, barberName: barber?.name ?? null };
      }),
    );
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Cancelling is a status write and nothing else. The `trg_free_slots_on_cancel`
   * trigger deletes this booking's `booking_slots` rows, which is what frees the slots
   * — the client must never delete those rows itself.
   */
  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);

    const { error: cancelError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);

    setCancellingId(null);

    if (cancelError) {
      toast.error(errMessage(cancelError, "無法取消這筆預約。"));
      return;
    }

    toast.success("預約已取消，時段已釋出。");
    await load();
  }

  return (
    <div className="min-h-screen bg-cream">
      <BrowseNav />

      <main className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="text-3xl sm:text-4xl">我的預約</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          時間以你所在時區顯示（{localTimeZoneLabel()}）。
        </p>

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="mt-10 text-sm text-muted-foreground">載入中…</p>
        ) : rows.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-border bg-card p-8 text-center shadow-card">
            <p className="text-sm text-muted-foreground">你還沒有任何預約。</p>
            <Link
              to="/barbers"
              className="mt-5 inline-block h-11 rounded-full bg-primary px-6 text-sm leading-[2.75rem] font-medium text-primary-foreground transition hover:opacity-90"
            >
              去找一位理髮師
            </Link>
          </div>
        ) : (
          <ul className="mt-10 space-y-4">
            {rows.map(({ booking, service, barberName }) => {
              const cancelled = booking.status === "cancelled";
              return (
                <li
                  key={booking.id ?? `${booking.service_id}-${booking.created_at}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-card p-5 shadow-card"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {barberName ?? "理髮師"} · {service?.name ?? "服務"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {booking.starts_at
                        ? `${formatDay(booking.starts_at)} ${formatTime(booking.starts_at)}${
                            booking.ends_at ? ` – ${formatTime(booking.ends_at)}` : ""
                          }`
                        : "時間未定"}
                    </p>
                    <p className="mt-1 text-sm">
                      {booking.price === null ? "—" : formatMoney(booking.price, config)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        cancelled
                          ? "bg-secondary text-muted-foreground"
                          : "bg-accent text-accent-foreground"
                      }`}
                    >
                      {BOOKING_STATUS_LABELS[booking.status ?? ""] ?? booking.status}
                    </span>

                    {!cancelled && booking.id && (
                      <button
                        type="button"
                        onClick={() => handleCancel(booking.id as string)}
                        disabled={cancellingId === booking.id}
                        className="h-9 rounded-full border border-border px-4 text-sm font-medium transition hover:bg-secondary disabled:opacity-60"
                      >
                        {cancellingId === booking.id ? "取消中…" : "取消 Cancel"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
