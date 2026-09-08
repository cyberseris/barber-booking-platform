import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Barber = Tables<"barbers">;
export type Service = Tables<"services">;
export type BookableSlot = Tables<"bookable_slots">;
export type BarberPhoto = Tables<"barber_photos">;

/**
 * The canonical role values are customer | shop | admin, but the sign-up tab and the
 * "Become a shop" upgrade only ever write customer | shop. `admin` is promoted by a
 * migration later in the course and is never self-served from the browser.
 */
export type SelfServeRole = "customer" | "shop";

export const SERVICE_CATEGORIES = ["cut", "color", "perm", "beard"] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const SERVICE_CATEGORY_LABELS: Record<ServiceCategory, string> = {
  cut: "剪髮 Cut",
  color: "染髮 Color",
  perm: "燙髮 Perm",
  beard: "修鬍 Beard",
};

/** The Storage bucket holding each barber's sample hairstyle photos. */
export const PHOTO_BUCKET = "barber-photos";

/**
 * Platform-wide config, read from the single `platform_settings` row. Money columns are
 * whole integers in `currency`; `currencyMinorUnits` is how many decimals to DISPLAY
 * (0 for whole TWD) — it is not a payment-provider exponent. A bookable slot is one
 * `slotMinutes`-long window.
 */
export interface PlatformConfig {
  currency: string;
  currencyMinorUnits: number;
  slotMinutes: number;
}

/** Mirrors the table defaults; only ever visible for the first paint before the row loads. */
export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  currency: "twd",
  currencyMinorUnits: 0,
  slotMinutes: 30,
};

/** Formats a whole-unit amount for display. Never multiplies — the DB stores 300 for NT$300. */
export function formatMoney(amount: number, config: PlatformConfig): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: config.currency.toUpperCase(),
      minimumFractionDigits: config.currencyMinorUnits,
      maximumFractionDigits: config.currencyMinorUnits,
    }).format(amount);
  } catch {
    return `${config.currency.toUpperCase()} ${amount}`;
  }
}

/**
 * Where a signed-in user belongs, branched on `profiles.role`.
 *
 * M1.1 branches shop vs customer ONLY. There is no logged-in admin at this point in the
 * course — admin is first promoted in the M2.1 prerequisite — so an admin branch here
 * would be unreachable dead code pointing at a page that does not exist yet.
 */
export function homePathForRole(role: string | null | undefined): string {
  return role === "shop" ? "/shop" : "/barbers";
}

/** Splits an uploaded file name into a safe lowercase extension, defaulting to jpg. */
export function fileExtension(fileName: string): string {
  const parts = fileName.split(".");
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  if (!last) return "jpg";
  const cleaned = last.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned.length > 0 && cleaned.length <= 5 ? cleaned : "jpg";
}

/** Local `<input type="datetime-local">`-style value → an ISO timestamp. */
export function toIsoTimestamp(date: string, time: string): string | null {
  const parsed = new Date(`${date}T${time}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function formatSlotRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = start.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const endTime = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${startTime} – ${endTime}`;
}
