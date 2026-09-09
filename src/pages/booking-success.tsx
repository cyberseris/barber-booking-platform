import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { BrowseNav } from "@/components/browse-nav";
import { supabase } from "@/integrations/supabase/client";

/**
 * Where Stripe drops the customer after a successful payment.
 *
 * This page is UX ONLY — it POLLS and never writes. The webhook
 * (`POST /api/stripe/webhook`) is the single source of truth for `paid`; a customer can
 * close the browser the moment they pay, or the redirect can drop entirely, and the
 * booking must still be confirmed. So "still processing" here means "the webhook hasn't
 * landed yet", never "the payment failed".
 *
 * We poll on `booking_id` (carried in Step 4's success_url), NOT `session_id`: nothing on
 * the booking maps a Stripe session_id back to a booking, so session_id alone gives the
 * poll no key. The read stays RLS-gated to the owning customer.
 */
export default function BookingSuccess() {
  const [params] = useSearchParams();
  const bookingId = params.get("booking_id");

  const [status, setStatus] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!bookingId) return;

    let cancelled = false;
    let attempts = 0;

    async function poll() {
      const { data } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", bookingId as string)
        .maybeSingle();

      if (cancelled) return;

      if (data?.status) {
        setStatus(data.status);
        if (data.status === "paid") return; // settled — stop polling
      }

      attempts += 1;
      // ~60s of polling. Past that we stop spinning and explain, rather than looping
      // forever: the webhook may simply be slow, and the booking is safe either way.
      if (attempts >= 30) {
        setTimedOut(true);
        return;
      }
      window.setTimeout(poll, 2000);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const paid = status === "paid";

  return (
    <div className="min-h-screen bg-background">
      <BrowseNav />

      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        {!bookingId ? (
          <>
            <h1 className="text-2xl font-semibold">找不到這筆預約</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              網址缺少預約編號。你可以到「我的預約」查看最新狀態。
            </p>
          </>
        ) : paid ? (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl">
              ✓
            </div>
            <h1 className="mt-6 text-2xl font-semibold">預約成功！</h1>
            <p className="mt-3 text-sm text-muted-foreground">付款已完成，時段已經幫你保留。</p>
          </>
        ) : timedOut ? (
          <>
            <h1 className="text-2xl font-semibold">還在確認付款中…</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              付款可能已經成功，只是確認訊息還沒送達。你的預約不會因為關掉這一頁而消失——
              請稍後到「我的預約」重新整理查看。
            </p>
          </>
        ) : (
          <>
            <div
              className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"
              aria-hidden
            />
            <h1 className="mt-6 text-2xl font-semibold">付款處理中…</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              正在等待 Stripe 確認付款，這通常只要幾秒鐘。請不要關閉這個頁面。
            </p>
          </>
        )}

        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/bookings"
            className="h-11 rounded-full bg-primary px-6 text-sm font-medium leading-[2.75rem] text-primary-foreground transition hover:opacity-90"
          >
            我的預約
          </Link>
          <Link
            to="/barbers"
            className="h-11 rounded-full border border-border px-6 text-sm font-medium leading-[2.75rem] transition hover:bg-secondary"
          >
            繼續逛
          </Link>
        </div>
      </main>
    </div>
  );
}
