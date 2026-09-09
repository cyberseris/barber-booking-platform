import { useEffect, useMemo, useState } from "react";

import { ShopNav } from "@/components/shop-nav";
import { useAuthContext } from "@/hooks/use-authenticated-user";
import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PLATFORM_CONFIG,
  PAYOUT_STATUS_LABELS,
  formatMoney,
  type OwedBooking,
  type Payout,
  type PayoutStatus,
  type PlatformConfig,
} from "@/lib/shop";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function currentMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
}

function statusBadgeClass(status: string): string {
  if (status === "transferred") return "bg-emerald-100 text-emerald-800";
  return "bg-accent text-accent-foreground";
}

interface Stats {
  bookings: number;
  gross: number;
  platformCut: number;
  shopCut: number;
}

/**
 * Combines the still-owed rows with the non-cancelled payouts' snapshotted totals.
 * A cancelled payout's bookings have already reverted to `owed` (their `payout_id` was
 * nulled), so it's excluded here to avoid double-counting.
 */
function computeStats(owedRows: OwedBooking[], activePayouts: Payout[]): Stats {
  const fromOwed = owedRows.reduce(
    (acc, row) => ({
      bookings: acc.bookings + 1,
      gross: acc.gross + (row.price ?? 0),
      platformCut: acc.platformCut + (row.platform_cut ?? 0),
      shopCut: acc.shopCut + (row.shop_cut ?? 0),
    }),
    { bookings: 0, gross: 0, platformCut: 0, shopCut: 0 },
  );
  return activePayouts.reduce(
    (acc, payout) => ({
      bookings: acc.bookings + payout.bookings_count,
      gross: acc.gross + payout.gross,
      platformCut: acc.platformCut + payout.platform_cut,
      shopCut: acc.shopCut + payout.shop_cut,
    }),
    fromOwed,
  );
}

export default function ShopEarnings() {
  usePageMeta({
    title: "收入 — Barberly",
    description: "See what you're still owed and what's already in a payout.",
    ogTitle: "收入 — Barberly",
    ogDescription: "Your Barberly earnings, owed vs paid out.",
  });

  const { user } = useAuthContext();

  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [owed, setOwed] = useState<OwedBooking[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("currency, currency_minor_units, slot_minutes")
        .maybeSingle();
      if (active && data) {
        setConfig({
          currency: data.currency,
          currencyMinorUnits: data.currency_minor_units,
          slotMinutes: data.slot_minutes,
        });
      }
    })();

    void (async () => {
      // RLS scopes both reads to this shop automatically, but filtering explicitly
      // keeps the query intent-revealing and cheap either way.
      const [owedResult, payoutsResult] = await Promise.all([
        supabase
          .from("owed_bookings")
          .select("*")
          .eq("shop_id", user.id)
          .order("paid_at", { ascending: false }),
        supabase
          .from("payouts")
          .select("*")
          .eq("shop_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;

      if (owedResult.error) setError(owedResult.error.message);
      else setOwed(owedResult.data ?? []);

      if (payoutsResult.error) setError((current) => current ?? payoutsResult.error!.message);
      else setPayouts(payoutsResult.data ?? []);

      setLoaded(true);
    })();

    return () => {
      active = false;
    };
  }, [user.id]);

  // A cancelled payout's bookings already reverted to owed — exclude it everywhere here.
  const activePayouts = useMemo(() => payouts.filter((p) => p.status !== "cancelled"), [payouts]);

  const monthPrefix = currentMonthPrefix();
  const monthlyOwed = useMemo(
    () => owed.filter((row) => row.paid_at?.startsWith(monthPrefix)),
    [owed, monthPrefix],
  );
  const monthlyPayouts = useMemo(
    () => activePayouts.filter((p) => p.created_at.startsWith(monthPrefix)),
    [activePayouts, monthPrefix],
  );

  const totalStats = useMemo(() => computeStats(owed, activePayouts), [owed, activePayouts]);
  const monthlyStats = useMemo(
    () => computeStats(monthlyOwed, monthlyPayouts),
    [monthlyOwed, monthlyPayouts],
  );

  return (
    <div className="min-h-screen bg-cream">
      <ShopNav email={user.email} />

      <main className="mx-auto max-w-5xl space-y-8 px-5 py-10">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">收入 / Earnings</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            這裡合併你所有理髮師的預約收入。平台會分批結算並撥款給你 / We settle and pay out your
            earnings in batches.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">本月 / This month</h2>
              <p className="mt-2 text-sm">
                {monthlyStats.bookings} 筆預約 · 總額 {formatMoney(monthlyStats.gross, config)} ·
                平台抽成 {formatMoney(monthlyStats.platformCut, config)}
              </p>
              <p className="mt-1 text-2xl font-medium">
                {formatMoney(monthlyStats.shopCut, config)}
              </p>
            </div>
            <div>
              <h2 className="text-sm font-medium text-muted-foreground">累計 / All time</h2>
              <p className="mt-2 text-sm">
                {totalStats.bookings} 筆預約 · 總額 {formatMoney(totalStats.gross, config)} ·
                平台抽成 {formatMoney(totalStats.platformCut, config)}
              </p>
              <p className="mt-1 text-2xl font-medium">{formatMoney(totalStats.shopCut, config)}</p>
            </div>
          </div>
        </section>

        {/* ── Owed (not yet in any payout) ──────────────────────────── */}
        <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
          <h2 className="font-display text-2xl">尚未撥款 / Owed</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">已付款、還沒被納入撥款的預約。</p>

          <ul className="mt-6 space-y-2">
            {loaded && owed.length === 0 && (
              <li className="text-sm text-muted-foreground">目前沒有還沒撥款的預約。</li>
            )}
            {owed.map((row) => (
              <li
                key={row.booking_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm"
              >
                <span>
                  {formatDate(row.paid_at)} · {row.barber_name ?? "—"}
                </span>
                <span className="font-medium">{formatMoney(row.shop_cut ?? 0, config)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── In a payout (pending_transfer or transferred) ─────────── */}
        <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
          <h2 className="font-display text-2xl">已納入撥款 / In a payout</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            已經被 admin 建立成撥款批次的預約，依批次分組。
          </p>

          <ul className="mt-6 space-y-3">
            {loaded && activePayouts.length === 0 && (
              <li className="text-sm text-muted-foreground">目前沒有已納入撥款的預約。</li>
            )}
            {activePayouts.map((payout) => {
              const status = payout.status as PayoutStatus;
              return (
                <li key={payout.id} className="rounded-2xl border border-border p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(payout.created_at)} · {payout.bookings_count} 筆預約
                      </p>
                      <p className="mt-1 text-lg font-medium">
                        {formatMoney(payout.shop_cut, config)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(status)}`}
                    >
                      {PAYOUT_STATUS_LABELS[status] ?? status}
                      {status === "transferred" &&
                        payout.marked_transferred_at &&
                        ` · ${formatDate(payout.marked_transferred_at)}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}
