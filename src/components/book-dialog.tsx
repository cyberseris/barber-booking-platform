import { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  consecutiveRun,
  formatDay,
  formatTime,
  localDateKey,
  localTimeZoneLabel,
} from "@/lib/booking";
import { errMessage } from "@/lib/errors";
import {
  SERVICE_CATEGORY_LABELS,
  formatMoney,
  type BookableSlot,
  type PlatformConfig,
  type Service,
  type ServiceCategory,
} from "@/lib/shop";

interface BookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barberName: string;
  services: Service[];
  /** Future slots with NO `booking_slots` row referencing them, sorted by `starts_at`. */
  freeSlots: BookableSlot[];
  config: PlatformConfig;
}

/**
 * The signature M1.2 interaction: a modal over /barbers/:id. The customer picks
 * service → date → start slot and confirms; the page never navigates away.
 *
 * Service comes first because it decides two things: the price shown before Confirm,
 * and N = `service.required_slots` — how many consecutive slots the booking spans.
 *
 * M2.1: Confirm is now PAY-NOW. It still calls the `create_booking` RPC (booking + its N
 * `booking_slots` rows + the price snapshot, in ONE transaction), then hands the returned
 * `booking_id` to `POST /api/bookings/checkout` and leaves the SPA for Stripe's hosted
 * page. The booking stays `pending_payment` until the WEBHOOK sees the payment — this
 * dialog never marks anything paid.
 */
export function BookDialog({
  open,
  onOpenChange,
  barberName,
  services,
  freeSlots,
  config,
}: BookDialogProps) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [startSlotId, setStartSlotId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = useMemo(
    () => services.find((candidate) => candidate.id === serviceId) ?? null,
    [services, serviceId],
  );

  const dates = useMemo(() => {
    const keys = new Set(freeSlots.map((slot) => localDateKey(slot.starts_at)));
    return [...keys].sort();
  }, [freeSlots]);

  // Reset the picked start slot whenever the choice that decides eligibility changes:
  // a different service needs a different number of back-to-back slots.
  useEffect(() => {
    setStartSlotId(null);
  }, [serviceId, dateKey]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setServiceId((current) => current ?? services[0]?.id ?? null);
    setDateKey((current) => (current && dates.includes(current) ? current : (dates[0] ?? null)));
  }, [open, services, dates]);

  const requiredSlots = service?.required_slots ?? 1;

  /** Every free slot on the chosen day, with the run it would start (null = can't start here). */
  const daySlots = useMemo(() => {
    return freeSlots
      .map((slot, index) => ({
        slot,
        run: consecutiveRun(freeSlots, index, requiredSlots),
      }))
      .filter((entry) => dateKey !== null && localDateKey(entry.slot.starts_at) === dateKey);
  }, [freeSlots, requiredSlots, dateKey]);

  const selectedRun = useMemo(
    () => daySlots.find((entry) => entry.slot.id === startSlotId)?.run ?? null,
    [daySlots, startSlotId],
  );

  // Every slot the booking would consume — used to highlight the WHOLE span, so a
  // 90-minute perm visibly eats three cells instead of looking like a single pick.
  const runSlotIds = useMemo(
    () => new Set((selectedRun ?? []).map((slot) => slot.id)),
    [selectedRun],
  );

  // The span's first and last slot — the booking runs from one's start to the other's end.
  const runStart = selectedRun?.[0];
  const runEnd = selectedRun?.[selectedRun.length - 1];

  async function handleConfirm() {
    if (!service || !startSlotId) return;

    setSubmitting(true);
    setError(null);

    // Step 1 — the M1.2 transaction: pending_payment booking + its N booking_slots rows
    // + the price SNAPSHOT. The slots are held from this moment (UNIQUE(slot_id) allows
    // one live booking per slot), so nobody else can start paying for the same run.
    const { data: bookingId, error: rpcError } = await supabase.rpc("create_booking", {
      p_service_id: service.id,
      p_start_slot_id: startSlotId,
    });

    if (rpcError || !bookingId) {
      setSubmitting(false);
      // The RPC raises real messages ("those times were just taken", "…has a gap").
      // errMessage digs them out of the PostgrestError instead of swallowing them.
      setError(errMessage(rpcError, "無法完成預約，請再試一次。"));
      return;
    }

    // Step 2 — hand the booking to Stripe Checkout. The route reads the price snapshot
    // server-side; we never send an amount from the browser.
    try {
      const response = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "無法建立付款頁面");
      }

      // Leave the SPA for Stripe's hosted page. Deliberately no setSubmitting(false) —
      // the button stays disabled through the redirect so a double-click can't re-book.
      window.location.assign(payload.url);
    } catch (cause) {
      setSubmitting(false);
      setError(
        `${errMessage(cause, "無法前往付款頁面")}。預約已建立但尚未付款，可以到「我的預約」取消後再試一次。`,
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>預約 {barberName}</DialogTitle>
          <DialogDescription>
            選擇服務、日期與開始時段。時間以你所在時區顯示（{localTimeZoneLabel()}）。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-medium">1. 選擇服務 / Service</h3>
            {services.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">這位理髮師還沒有提供服務項目。</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {services.map((option) => {
                  const active = option.id === serviceId;
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        onClick={() => setServiceId(option.id)}
                        aria-pressed={active}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? "border-primary bg-secondary"
                            : "border-border hover:bg-secondary"
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-medium">{option.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {SERVICE_CATEGORY_LABELS[option.category as ServiceCategory] ??
                              option.category}{" "}
                            · {option.required_slots * config.slotMinutes} 分鐘（
                            {option.required_slots} 個時段）
                          </span>
                        </span>
                        <span className="text-sm font-medium">
                          {formatMoney(option.price, config)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium">2. 選擇日期 / Date</h3>
            {dates.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">目前沒有可預約的時段。</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {dates.map((key) => {
                  const sample = freeSlots.find((slot) => localDateKey(slot.starts_at) === key);
                  const active = key === dateKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDateKey(key)}
                      aria-pressed={active}
                      className={`h-9 rounded-full border px-4 text-sm font-medium transition ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {sample ? formatDay(sample.starts_at) : key}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium">3. 選擇開始時段 / Start time</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              此服務會連續佔用 {requiredSlots} 個時段（每個 {config.slotMinutes} 分鐘）。
            </p>

            {daySlots.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">這一天沒有可預約的時段。</p>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {daySlots.map(({ slot, run }) => {
                  const eligible = run !== null;
                  const inSelectedRun = runSlotIds.has(slot.id);
                  const isStart = slot.id === startSlotId;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={!eligible}
                      onClick={() => setStartSlotId(slot.id)}
                      aria-pressed={isStart}
                      // A slot that can't START a booking is dimmed WITH a reason: it may
                      // still be bookable as part of a run that starts earlier, and an
                      // unexplained grey cell is exactly what confuses customers.
                      title={
                        eligible
                          ? undefined
                          : `無法從這裡開始：後面沒有連續 ${requiredSlots} 個空時段`
                      }
                      className={`rounded-xl border px-2 py-2 text-sm transition ${
                        !eligible
                          ? "cursor-not-allowed border-dashed border-border text-muted-foreground/60"
                          : inSelectedRun
                            ? "border-primary bg-secondary font-medium"
                            : "border-border hover:bg-secondary"
                      } ${isStart ? "ring-2 ring-ring/50" : ""}`}
                    >
                      {formatTime(slot.starts_at)}
                      {!eligible && (
                        <span className="mt-0.5 block text-[10px] leading-tight">時段不足</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {service && runStart && runEnd && (
            <div className="rounded-2xl border border-border bg-secondary/60 p-4 text-sm">
              <p className="font-medium">
                你的預約：{formatDay(runStart.starts_at)} {formatTime(runStart.starts_at)} –{" "}
                {formatTime(runEnd.ends_at)}
                {requiredSlots > 1 && `（連佔 ${requiredSlots} 個時段）`}
              </p>
              <p className="mt-1 text-muted-foreground">
                {service.name} · {formatMoney(service.price, config)}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-full border border-border px-6 text-sm font-medium transition hover:bg-secondary"
          >
            取消 Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!service || !startSlotId || submitting}
            className="h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "前往付款…" : "確認並付款 Confirm & pay"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
