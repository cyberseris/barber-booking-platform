import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminNav } from "@/components/admin-nav";
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

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/30";
const primaryButton =
  "h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60";
const secondaryButton =
  "h-9 rounded-full border border-border px-4 text-sm font-medium transition hover:bg-secondary disabled:opacity-60";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadgeClass(status: string): string {
  if (status === "transferred") return "bg-emerald-100 text-emerald-800";
  if (status === "cancelled") return "bg-secondary text-muted-foreground";
  return "bg-accent text-accent-foreground";
}

export default function AdminPayouts() {
  usePageMeta({
    title: "撥款管理 — Barberly Admin",
    description: "Review owed bookings, build shop payouts, and record bank transfers.",
    ogTitle: "撥款管理 — Barberly Admin",
    ogDescription: "The admin commission-settlement workflow.",
  });

  const { user } = useAuthContext();

  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);

  // ── Part 1: the live owed pool ──
  const [owed, setOwed] = useState<OwedBooking[]>([]);
  const [owedLoaded, setOwedLoaded] = useState(false);
  const [customerEmails, setCustomerEmails] = useState<Record<string, string>>({});
  const [owedError, setOwedError] = useState<string | null>(null);

  const [shopFilter, setShopFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  // ── Part 2: the payouts ledger ──
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutsLoaded, setPayoutsLoaded] = useState(false);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);
  const [bankRefDrafts, setBankRefDrafts] = useState<Record<string, string>>({});
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("currency, currency_minor_units, slot_minutes")
        .maybeSingle();

      if (!active || !data) return;
      setConfig({
        currency: data.currency,
        currencyMinorUnits: data.currency_minor_units,
        slotMinutes: data.slot_minutes,
      });
    })();

    return () => {
      active = false;
    };
  }, []);

  // The VIEW already carries shop_name + barber_name (resolved inside the view), so we
  // read them straight off it. Customer email isn't on the view, so we resolve it with a
  // separate profiles fetch + a client-side lookup map — never a PostgREST embed on a view.
  const loadOwed = useCallback(async () => {
    setOwedError(null);
    const { data, error } = await supabase
      .from("owed_bookings")
      .select("*")
      .order("paid_at", { ascending: false });

    if (error) {
      setOwedError(error.message);
      setOwedLoaded(true);
      return;
    }

    const rows = data ?? [];
    setOwed(rows);
    setOwedLoaded(true);

    const customerIds = Array.from(
      new Set(rows.map((row) => row.customer_id).filter((id): id is string => !!id)),
    );
    if (customerIds.length === 0) {
      setCustomerEmails({});
      return;
    }
    const { data: customers } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", customerIds);
    const map: Record<string, string> = {};
    for (const c of customers ?? []) {
      if (c.email) map[c.id] = c.email;
    }
    setCustomerEmails(map);
  }, []);

  const loadPayouts = useCallback(async () => {
    setPayoutsError(null);
    const { data, error } = await supabase
      .from("payouts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setPayoutsError(error.message);
      setPayoutsLoaded(true);
      return;
    }
    setPayouts(data ?? []);
    setPayoutsLoaded(true);
  }, []);

  useEffect(() => {
    void loadOwed();
    void loadPayouts();
  }, [loadOwed, loadPayouts]);

  const shopOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of owed) {
      if (row.shop_id && !map.has(row.shop_id)) {
        map.set(row.shop_id, row.shop_name ?? "（未命名店家 / unnamed shop）");
      }
    }
    return Array.from(map.entries());
  }, [owed]);

  const filteredOwed = useMemo(() => {
    return owed.filter((row) => {
      if (shopFilter && row.shop_id !== shopFilter) return false;
      if (customerFilter) {
        const email = row.customer_id ? customerEmails[row.customer_id] : undefined;
        if (!email || !email.toLowerCase().includes(customerFilter.trim().toLowerCase())) {
          return false;
        }
      }
      if (dateFrom && row.paid_at && row.paid_at < dateFrom) return false;
      if (dateTo && row.paid_at && row.paid_at > `${dateTo}T23:59:59`) return false;
      return true;
    });
  }, [owed, shopFilter, customerFilter, dateFrom, dateTo, customerEmails]);

  // A selection may only span ONE shop — build_payout rejects a mixed-shop selection.
  // We keep the UI honest about that by tracking which shop the current selection
  // belongs to, and disabling checkboxes for any other shop's rows meanwhile.
  const selectedShopId = useMemo(() => {
    for (const row of owed) {
      if (row.booking_id && selected.has(row.booking_id)) return row.shop_id;
    }
    return null;
  }, [owed, selected]);

  const selectedRows = useMemo(
    () => owed.filter((row) => row.booking_id && selected.has(row.booking_id)),
    [owed, selected],
  );

  const runningTotal = useMemo(
    () =>
      selectedRows.reduce(
        (acc, row) => ({
          gross: acc.gross + (row.price ?? 0),
          platformCut: acc.platformCut + (row.platform_cut ?? 0),
          shopCut: acc.shopCut + (row.shop_cut ?? 0),
        }),
        { gross: 0, platformCut: 0, shopCut: 0 },
      ),
    [selectedRows],
  );

  function toggleRow(row: OwedBooking) {
    if (!row.booking_id) return;
    setBuildError(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(row.booking_id!)) {
        next.delete(row.booking_id!);
        return next;
      }
      // Switching shops mid-selection starts a fresh selection rather than mixing them.
      if (selectedShopId && row.shop_id !== selectedShopId) {
        return new Set([row.booking_id!]);
      }
      next.add(row.booking_id!);
      return next;
    });
  }

  function selectAllOwedThisMonthForShop(targetShopId: string) {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}`;
    const matching = owed.filter(
      (row) =>
        row.booking_id && row.shop_id === targetShopId && row.paid_at?.startsWith(monthPrefix),
    );
    setSelected(new Set(matching.map((row) => row.booking_id!)));
    setBuildError(null);
  }

  async function handleBuildPayout() {
    setBuildError(null);
    if (selected.size === 0) return;

    setBuilding(true);
    const trimmedNote = note.trim();
    const { error } = await supabase.rpc("build_payout", {
      p_booking_ids: Array.from(selected),
      ...(trimmedNote ? { p_note: trimmedNote } : {}),
    });
    setBuilding(false);

    if (error) {
      setBuildError(error.message);
      return;
    }

    setSelected(new Set());
    setNote("");
    await Promise.all([loadOwed(), loadPayouts()]);
  }

  async function handleMarkTransferred(payout: Payout) {
    setPayoutsError(null);
    setMarkingId(payout.id);
    const bankReference = bankRefDrafts[payout.id]?.trim();
    const { error } = await supabase.rpc("mark_payout_transferred", {
      p_payout_id: payout.id,
      ...(bankReference ? { p_bank_reference: bankReference } : {}),
    });
    setMarkingId(null);

    if (error) {
      setPayoutsError(error.message);
      return;
    }
    await loadPayouts();
  }

  async function handleCancel(payout: Payout) {
    if (
      !window.confirm(
        `取消這筆撥款？這筆撥款包含的 ${payout.bookings_count} 筆預約會退回欠款池。\nCancel this payout? Its ${payout.bookings_count} booking(s) will return to the owed pool.`,
      )
    ) {
      return;
    }
    setPayoutsError(null);
    setCancellingId(payout.id);
    const { error } = await supabase.rpc("cancel_payout", { p_payout_id: payout.id });
    setCancellingId(null);

    if (error) {
      setPayoutsError(error.message);
      return;
    }
    await Promise.all([loadOwed(), loadPayouts()]);
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav email={user.email} />

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-10">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">撥款管理 / Payouts</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            從「欠款池」（還沒撥款的 paid bookings）勾選同一間店家的預約，建立一筆待轉帳的撥款；
            轉帳後回來標記已轉帳。
          </p>
        </div>

        {/* ── Part 1: the owed-pool builder ─────────────────────────── */}
        <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
          <h2 className="font-display text-2xl">欠款池 / Owed bookings</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            每一列是一筆已付款、還沒被納入任何撥款的預約。勾選同一間店家的幾筆，建立一次撥款。
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="shop-filter" className="text-sm font-medium">
                店家 Shop
              </label>
              <select
                id="shop-filter"
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">全部 / All shops</option>
                {shopOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="customer-filter" className="text-sm font-medium">
                顧客 Customer email
              </label>
              <input
                id="customer-filter"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                placeholder="搜尋 email"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="date-from" className="text-sm font-medium">
                付款日 From
              </label>
              <input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="date-to" className="text-sm font-medium">
                付款日 To
              </label>
              <input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {shopFilter && (
            <button
              type="button"
              onClick={() => selectAllOwedThisMonthForShop(shopFilter)}
              className={`${secondaryButton} mt-4`}
            >
              全選此店本月欠款 / Select all owed for this shop this month
            </button>
          )}

          {owedError && <p className="mt-4 text-sm text-destructive">{owedError}</p>}

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="w-8 py-2" />
                  <th className="py-2 pr-4">店家 Shop</th>
                  <th className="py-2 pr-4">理髮師 Barber</th>
                  <th className="py-2 pr-4">顧客 Customer</th>
                  <th className="py-2 pr-4">付款日 Paid</th>
                  <th className="py-2 pr-4 text-right">金額 Price</th>
                  <th className="py-2 pr-4 text-right">平台抽成</th>
                  <th className="py-2 text-right">店家收入</th>
                </tr>
              </thead>
              <tbody>
                {owedLoaded && filteredOwed.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      沒有符合條件的欠款預約 / no owed bookings match these filters.
                    </td>
                  </tr>
                )}
                {filteredOwed.map((row) => {
                  const isChecked = !!row.booking_id && selected.has(row.booking_id);
                  const isDisabled =
                    !!selectedShopId && row.shop_id !== selectedShopId && !isChecked;
                  return (
                    <tr key={row.booking_id} className="border-b border-border/60">
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={() => toggleRow(row)}
                        />
                      </td>
                      <td className="py-2 pr-4">{row.shop_name ?? "—"}</td>
                      <td className="py-2 pr-4">{row.barber_name ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {row.customer_id ? (customerEmails[row.customer_id] ?? "—") : "—"}
                      </td>
                      <td className="py-2 pr-4">{formatDate(row.paid_at)}</td>
                      <td className="py-2 pr-4 text-right">
                        {formatMoney(row.price ?? 0, config)}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {formatMoney(row.platform_cut ?? 0, config)}
                      </td>
                      <td className="py-2 text-right">{formatMoney(row.shop_cut ?? 0, config)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-end gap-4 rounded-2xl border border-dashed border-border p-5">
            <div className="flex-1">
              <p className="text-sm">
                已勾選 {selectedRows.length} 筆 · 總額 {formatMoney(runningTotal.gross, config)} ·
                平台抽成 {formatMoney(runningTotal.platformCut, config)} · 店家收入{" "}
                <strong>{formatMoney(runningTotal.shopCut, config)}</strong>
              </p>
              <div className="mt-2">
                <label htmlFor="payout-note" className="text-sm font-medium">
                  備註 Note
                </label>
                <input
                  id="payout-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例如：6 月撥款 / June payout"
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={building || selectedRows.length === 0}
              onClick={() => void handleBuildPayout()}
              className={primaryButton}
            >
              {building ? "建立中…" : "建立撥款 / Build payout"}
            </button>
          </div>
          {buildError && <p className="mt-3 text-sm text-destructive">{buildError}</p>}
        </section>

        {/* ── Part 2: the payouts ledger ────────────────────────────── */}
        <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
          <h2 className="font-display text-2xl">撥款紀錄 / Payouts ledger</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            每一列是一筆已建立的撥款批次。轉帳後在下方填入轉帳備註並按「標記為已轉帳」。
          </p>

          {payoutsError && <p className="mt-4 text-sm text-destructive">{payoutsError}</p>}

          <div className="mt-6 space-y-3">
            {payoutsLoaded && payouts.length === 0 && (
              <p className="text-sm text-muted-foreground">還沒有任何撥款紀錄。</p>
            )}
            {payouts.map((payout) => {
              const status = payout.status as PayoutStatus;
              const canAct = status === "pending_transfer";
              return (
                <article key={payout.id} className="rounded-2xl border border-border p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{payout.shop_name ?? "（未命名店家）"}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatDate(payout.created_at)} · {payout.bookings_count} 筆預約 · 總額{" "}
                        {formatMoney(payout.gross, config)} · 平台抽成{" "}
                        {formatMoney(payout.platform_cut, config)} · 店家收入{" "}
                        <strong>{formatMoney(payout.shop_cut, config)}</strong>
                      </p>
                      {payout.note && (
                        <p className="mt-1 text-sm text-muted-foreground">備註：{payout.note}</p>
                      )}
                      {payout.bank_reference && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          轉帳備註：{payout.bank_reference}
                        </p>
                      )}
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

                  {canAct && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
                      <input
                        value={bankRefDrafts[payout.id] ?? ""}
                        onChange={(e) =>
                          setBankRefDrafts((current) => ({
                            ...current,
                            [payout.id]: e.target.value,
                          }))
                        }
                        placeholder="轉帳備註（選填）/ bank reference (optional)"
                        className="h-9 flex-1 min-w-[200px] rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
                      />
                      <button
                        type="button"
                        disabled={markingId === payout.id}
                        onClick={() => void handleMarkTransferred(payout)}
                        className={secondaryButton}
                      >
                        {markingId === payout.id ? "處理中…" : "標記為已轉帳"}
                      </button>
                      <button
                        type="button"
                        disabled={cancellingId === payout.id}
                        onClick={() => void handleCancel(payout)}
                        className={secondaryButton}
                      >
                        {cancellingId === payout.id ? "處理中…" : "取消"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
