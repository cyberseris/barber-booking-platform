import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { ShopNav } from "@/components/shop-nav";
import { useAuthContext } from "@/hooks/use-authenticated-user";
import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PLATFORM_CONFIG,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  type Barber,
  type BookableSlot,
  type PlatformConfig,
  type Service,
  type ServiceCategory,
  formatMoney,
  formatSlotRange,
} from "@/lib/shop";

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/30";
const primaryButton =
  "h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60";
const secondaryButton =
  "h-9 rounded-full border border-border px-4 text-sm font-medium transition hover:bg-secondary disabled:opacity-60";

/** Guards against a mistyped time range turning into thousands of inserts. */
const MAX_SLOTS_PER_BATCH = 96;

interface ServiceForm {
  name: string;
  category: ServiceCategory;
  price: string;
  requiredSlots: string;
}

const emptyServiceForm: ServiceForm = {
  name: "",
  category: "cut",
  price: "",
  requiredSlots: "1",
};

function todayIsoDate(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Splits a local time range into consecutive `slotMinutes`-long windows. A bookable slot
 * is exactly one such window — publishing a longer opening means publishing a run of
 * consecutive slots, which is what a service's `required_slots` later spans.
 */
function buildSlotWindows(
  date: string,
  startTime: string,
  endTime: string,
  slotMinutes: number,
): { starts_at: string; ends_at: string }[] {
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end.getTime() <= start.getTime()) return [];

  const windows: { starts_at: string; ends_at: string }[] = [];
  let cursor = start.getTime();
  const endMs = end.getTime();
  const stepMs = slotMinutes * 60_000;

  while (cursor + stepMs <= endMs && windows.length < MAX_SLOTS_PER_BATCH) {
    const next = cursor + stepMs;
    windows.push({
      starts_at: new Date(cursor).toISOString(),
      ends_at: new Date(next).toISOString(),
    });
    cursor = next;
  }

  return windows;
}

export default function ShopBookings() {
  usePageMeta({
    title: "服務與時段 — Barberly",
    description: "Publish your services, prices and bookable time slots.",
    ogTitle: "服務與時段 — Barberly",
    ogDescription: "Publish services and bookable slots.",
  });

  const { user } = useAuthContext();

  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barbersLoaded, setBarbersLoaded] = useState(false);
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(emptyServiceForm);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);

  const [slots, setSlots] = useState<BookableSlot[]>([]);
  const [slotDate, setSlotDate] = useState(todayIsoDate());
  const [slotStart, setSlotStart] = useState("10:00");
  const [slotEnd, setSlotEnd] = useState("13:00");
  const [publishingSlots, setPublishingSlots] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  // ── Load platform config + this shop's barbers ──
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

  const loadBarbers = useCallback(async () => {
    const { data, error } = await supabase
      .from("barbers")
      .select("*")
      .eq("shop_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      setServiceError(error.message);
      setBarbersLoaded(true);
      return;
    }

    const rows = data ?? [];
    setBarbers(rows);
    setBarbersLoaded(true);
    setSelectedBarberId((current) => current ?? rows[0]?.id ?? null);
  }, [user.id]);

  useEffect(() => {
    void loadBarbers();
  }, [loadBarbers]);

  // ── Load the selected barber's services + published slots ──
  const loadBarberData = useCallback(async (barberId: string) => {
    const [serviceResult, slotResult] = await Promise.all([
      supabase
        .from("services")
        .select("*")
        .eq("barber_id", barberId)
        .order("created_at", { ascending: true }),
      supabase
        .from("bookable_slots")
        .select("*")
        .eq("barber_id", barberId)
        .order("starts_at", { ascending: true }),
    ]);

    if (serviceResult.error) setServiceError(serviceResult.error.message);
    else setServices(serviceResult.data ?? []);

    if (slotResult.error) setSlotError(slotResult.error.message);
    else setSlots(slotResult.data ?? []);
  }, []);

  useEffect(() => {
    if (!selectedBarberId) {
      setServices([]);
      setSlots([]);
      return;
    }
    void loadBarberData(selectedBarberId);
  }, [selectedBarberId, loadBarberData]);

  const plannedWindows = useMemo(
    () => buildSlotWindows(slotDate, slotStart, slotEnd, config.slotMinutes),
    [slotDate, slotStart, slotEnd, config.slotMinutes],
  );

  function resetServiceForm() {
    setServiceForm(emptyServiceForm);
    setEditingServiceId(null);
  }

  async function handleSubmitService(event: React.FormEvent) {
    event.preventDefault();
    setServiceError(null);

    if (!selectedBarberId) return;

    if (serviceForm.name.trim() === "") {
      setServiceError("服務名稱是必填。A service needs a name.");
      return;
    }

    // price is a WHOLE-unit integer in platform_settings.currency — 300 means NT$300.
    // There is deliberately no ×100 here; that scaling belongs at the payment boundary.
    const price = Number.parseInt(serviceForm.price, 10);
    const requiredSlots = Number.parseInt(serviceForm.requiredSlots, 10);

    if (!Number.isInteger(price) || price < 0) {
      setServiceError("價格必須是 0 以上的整數。Price must be a whole number.");
      return;
    }
    if (!Number.isInteger(requiredSlots) || requiredSlots < 1) {
      setServiceError("所需時段數至少是 1。Required slots must be at least 1.");
      return;
    }

    setSavingService(true);
    const payload = {
      barber_id: selectedBarberId,
      name: serviceForm.name.trim(),
      category: serviceForm.category,
      price,
      required_slots: requiredSlots,
    };

    const { error } = editingServiceId
      ? await supabase.from("services").update(payload).eq("id", editingServiceId)
      : await supabase.from("services").insert(payload);
    setSavingService(false);

    if (error) {
      setServiceError(error.message);
      return;
    }

    resetServiceForm();
    await loadBarberData(selectedBarberId);
  }

  function startEditingService(service: Service) {
    setEditingServiceId(service.id);
    setServiceForm({
      name: service.name,
      category: (SERVICE_CATEGORIES as readonly string[]).includes(service.category)
        ? (service.category as ServiceCategory)
        : "cut",
      price: `${service.price}`,
      requiredSlots: `${service.required_slots}`,
    });
  }

  async function handleDeleteService(serviceId: string) {
    if (!selectedBarberId) return;
    setServiceError(null);

    const { error } = await supabase.from("services").delete().eq("id", serviceId);
    if (error) {
      setServiceError(error.message);
      return;
    }
    if (editingServiceId === serviceId) resetServiceForm();
    await loadBarberData(selectedBarberId);
  }

  async function handlePublishSlots(event: React.FormEvent) {
    event.preventDefault();
    setSlotError(null);

    if (!selectedBarberId) return;

    if (plannedWindows.length === 0) {
      setSlotError(
        `這段時間產生不出任何時段（結束時間要晚於開始時間，且至少要容納一個 ${config.slotMinutes} 分鐘的時段）。`,
      );
      return;
    }

    setPublishingSlots(true);
    const { error } = await supabase
      .from("bookable_slots")
      .insert(plannedWindows.map((window) => ({ barber_id: selectedBarberId, ...window })));
    setPublishingSlots(false);

    if (error) {
      setSlotError(error.message);
      return;
    }

    await loadBarberData(selectedBarberId);
  }

  async function handleDeleteSlot(slotId: string) {
    if (!selectedBarberId) return;
    setSlotError(null);

    const { error } = await supabase.from("bookable_slots").delete().eq("id", slotId);
    if (error) {
      setSlotError(error.message);
      return;
    }
    await loadBarberData(selectedBarberId);
  }

  return (
    <div className="min-h-screen bg-cream">
      <ShopNav email={user.email} />

      <main className="mx-auto max-w-5xl space-y-8 px-5 py-10">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">服務與時段 / Services & slots</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            設定每位理髮師的服務與價格，並發布可預約的時間窗。每個時段長度是 {config.slotMinutes}{" "}
            分鐘。
          </p>
        </div>

        {barbersLoaded && barbers.length === 0 ? (
          <p className="rounded-2xl border border-border bg-accent/40 px-5 py-4 text-sm">
            你還沒有理髮師。先到{" "}
            <Link to="/shop" className="underline underline-offset-2">
              理髮店設定
            </Link>{" "}
            新增一位，才能設定服務與時段。
          </p>
        ) : (
          <>
            {/* ── Barber picker ─────────────────────────────────────── */}
            <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
              <label htmlFor="barber-picker" className="text-sm font-medium">
                選擇理髮師 / Barber
              </label>
              <select
                id="barber-picker"
                value={selectedBarberId ?? ""}
                onChange={(e) => setSelectedBarberId(e.target.value || null)}
                className={inputClass}
              >
                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </section>

            {/* ── A. Services & price editor ────────────────────────── */}
            <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
              <h2 className="font-display text-2xl">服務與價格 / Services & price</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                價格直接填整數金額（例如 300 就是 NT$300）。所需時段數是這個服務需要幾個連續時段。
              </p>

              {serviceError && <p className="mt-4 text-sm text-destructive">{serviceError}</p>}

              <ul className="mt-6 space-y-3">
                {services.length === 0 && (
                  <li className="text-sm text-muted-foreground">還沒有服務項目。</li>
                )}
                {services.map((service) => (
                  <li
                    key={service.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-border px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{service.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {
                          SERVICE_CATEGORY_LABELS[
                            (SERVICE_CATEGORIES as readonly string[]).includes(service.category)
                              ? (service.category as ServiceCategory)
                              : "cut"
                          ]
                        }{" "}
                        · {formatMoney(service.price, config)} · {service.required_slots} 個時段（
                        {service.required_slots * config.slotMinutes} 分鐘）
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingService(service)}
                        className={secondaryButton}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteService(service.id)}
                        className={secondaryButton}
                      >
                        刪除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <form
                onSubmit={handleSubmitService}
                className="mt-6 grid gap-4 rounded-2xl border border-dashed border-border p-5 sm:grid-cols-2"
              >
                <h3 className="text-sm font-medium sm:col-span-2">
                  {editingServiceId ? "編輯服務" : "新增服務"}
                </h3>

                <div>
                  <label htmlFor="service-name" className="text-sm font-medium">
                    名稱 Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="service-name"
                    required
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="service-category" className="text-sm font-medium">
                    分類 Category
                  </label>
                  <select
                    id="service-category"
                    value={serviceForm.category}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        category: e.target.value as ServiceCategory,
                      })
                    }
                    className={inputClass}
                  >
                    {SERVICE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {SERVICE_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="service-price" className="text-sm font-medium">
                    價格 Price ({config.currency.toUpperCase()}){" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="service-price"
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                    placeholder="300"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="service-slots" className="text-sm font-medium">
                    所需時段數 Required slots <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="service-slots"
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={serviceForm.requiredSlots}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, requiredSlots: e.target.value })
                    }
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    一個時段 {config.slotMinutes} 分鐘，所以 90 分鐘的服務填 3。
                  </p>
                </div>

                <div className="flex gap-3 sm:col-span-2">
                  <button type="submit" disabled={savingService} className={primaryButton}>
                    {savingService ? "儲存中…" : editingServiceId ? "儲存變更" : "新增服務"}
                  </button>
                  {editingServiceId && (
                    <button type="button" onClick={resetServiceForm} className={secondaryButton}>
                      取消
                    </button>
                  )}
                </div>
              </form>
            </section>

            {/* ── B. Bookable slot publisher ────────────────────────── */}
            <section className="rounded-3xl border border-border bg-card p-7 shadow-card">
              <h2 className="font-display text-2xl">可預約時段 / Bookable slots</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                選一段時間，系統會切成連續的 {config.slotMinutes} 分鐘時段。時段本身沒有狀態 —
                它就是一段可以被預約的時間窗。
              </p>

              <form onSubmit={handlePublishSlots} className="mt-6 grid gap-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="slot-date" className="text-sm font-medium">
                    日期 Date
                  </label>
                  <input
                    id="slot-date"
                    type="date"
                    required
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="slot-start" className="text-sm font-medium">
                    開始 From
                  </label>
                  <input
                    id="slot-start"
                    type="time"
                    required
                    value={slotStart}
                    onChange={(e) => setSlotStart(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="slot-end" className="text-sm font-medium">
                    結束 To
                  </label>
                  <input
                    id="slot-end"
                    type="time"
                    required
                    value={slotEnd}
                    onChange={(e) => setSlotEnd(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={publishingSlots || plannedWindows.length === 0}
                    className={primaryButton}
                  >
                    {publishingSlots ? "發布中…" : `發布 ${plannedWindows.length} 個時段`}
                  </button>
                </div>
              </form>

              {slotError && <p className="mt-4 text-sm text-destructive">{slotError}</p>}

              <h3 className="mt-8 text-sm font-medium">已發布的時段（{slots.length}）</h3>
              <ul className="mt-3 space-y-2">
                {slots.length === 0 && (
                  <li className="text-sm text-muted-foreground">還沒有發布任何時段。</li>
                )}
                {slots.map((slot) => (
                  <li
                    key={slot.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3"
                  >
                    <span className="flex-1 text-sm">
                      {formatSlotRange(slot.starts_at, slot.ends_at)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSlot(slot.id)}
                      className={secondaryButton}
                    >
                      刪除
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
