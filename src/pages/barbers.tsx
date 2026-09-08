import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

import { BrowseNav } from "@/components/browse-nav";
import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/integrations/supabase/client";
import { photoUrl } from "@/lib/booking";
import { errMessage } from "@/lib/errors";
import {
  DEFAULT_PLATFORM_CONFIG,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  formatMoney,
  type Barber,
  type BarberPhoto,
  type PlatformConfig,
  type Service,
  type ServiceCategory,
} from "@/lib/shop";

type Filter = "all" | ServiceCategory;

const FILTERS: Filter[] = ["all", ...SERVICE_CATEGORIES];

const FILTER_LABELS: Record<Filter, string> = {
  all: "全部 All",
  ...SERVICE_CATEGORY_LABELS,
};

interface BarberCard {
  barber: Barber;
  services: Service[];
  categories: ServiceCategory[];
  fromPrice: number | null;
  photo: BarberPhoto | null;
}

/**
 * The customer's browse page: every barber in a marketplace-style card grid, with a
 * keyword search and category chips. Public — you only need an account to actually book.
 */
export default function Barbers() {
  usePageMeta({
    title: "瀏覽理髮師 — Barberly",
    description: "Browse every barber on Barberly, see their work and book a slot.",
    ogTitle: "瀏覽理髮師 — Barberly",
    ogDescription: "Browse every barber on Barberly.",
  });

  const [cards, setCards] = useState<BarberCard[]>([]);
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      // Three public reads (RLS allows select on all three) joined client-side — the
      // course runs at tens of rows, so this is cheaper to read than a nested embed.
      const [barbersResult, servicesResult, photosResult, settingsResult] = await Promise.all([
        supabase.from("barbers").select("*").order("created_at", { ascending: true }),
        supabase.from("services").select("*"),
        supabase
          .from("barber_photos")
          .select("*")
          .order("is_featured", { ascending: false })
          .order("sort_order", { ascending: true }),
        supabase.from("platform_settings").select("*").maybeSingle(),
      ]);

      if (!active) return;

      const failure =
        barbersResult.error ?? servicesResult.error ?? photosResult.error ?? settingsResult.error;
      if (failure) {
        setError(errMessage(failure, "Could not load barbers."));
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

      const services = servicesResult.data ?? [];
      const photos = photosResult.data ?? [];

      setCards(
        (barbersResult.data ?? []).map((barber) => {
          const ownServices = services.filter((service) => service.barber_id === barber.id);
          const prices = ownServices.map((service) => service.price);

          return {
            barber,
            services: ownServices,
            categories: [
              ...new Set(ownServices.map((service) => service.category as ServiceCategory)),
            ],
            fromPrice: prices.length > 0 ? Math.min(...prices) : null,
            // Featured first, then sort_order — the shop's own idea of its best work.
            photo: photos.find((photo) => photo.barber_id === barber.id) ?? null,
          };
        }),
      );
      setError(null);
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return cards.filter((card) => {
      const matchesFilter = filter === "all" || card.categories.includes(filter);
      if (!matchesFilter) return false;
      if (needle.length === 0) return true;

      return [card.barber.name, card.barber.intro, card.barber.address]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [cards, filter, query]);

  return (
    <div className="min-h-screen bg-cream">
      <BrowseNav />

      <main className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-3xl sm:text-4xl">找一位理髮師</h1>
        <p className="mt-3 text-base text-muted-foreground">
          Browse every barber, see their work, and book a slot.
        </p>

        <div className="mt-8 flex flex-col gap-4">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋理髮師名稱或地址 / Search by name or address"
              aria-label="搜尋理髮師"
              className="h-12 w-full rounded-full border border-border bg-background pr-5 pl-11 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                aria-pressed={filter === option}
                className={`h-9 rounded-full border px-4 text-sm font-medium transition ${
                  filter === option
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {FILTER_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-8 text-sm text-destructive">{error}</p>}

        {loading ? (
          <p className="mt-12 text-sm text-muted-foreground">載入中…</p>
        ) : visible.length === 0 ? (
          <p className="mt-12 text-sm text-muted-foreground">
            找不到符合的理髮師。試試別的關鍵字或分類。
          </p>
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((card) => (
              <li key={card.barber.id}>
                <Link
                  to={`/barbers/${card.barber.id}`}
                  className="group block h-full overflow-hidden rounded-3xl border border-border bg-card shadow-card transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="aspect-4/3 overflow-hidden bg-secondary">
                    {card.photo ? (
                      <img
                        src={photoUrl(card.photo.storage_path)}
                        alt={`${card.barber.name} 的作品`}
                        loading="lazy"
                        className="size-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                        尚未上傳作品照
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <h2 className="font-display text-xl">{card.barber.name}</h2>
                    {card.barber.address && (
                      <p className="mt-1 text-sm text-muted-foreground">{card.barber.address}</p>
                    )}
                    {card.barber.intro && (
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {card.barber.intro}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {card.categories.map((category) => (
                        <span
                          key={category}
                          className="rounded-full bg-secondary px-3 py-1 text-xs font-medium"
                        >
                          {SERVICE_CATEGORY_LABELS[category]}
                        </span>
                      ))}
                    </div>

                    <p className="mt-4 text-sm font-medium">
                      {card.fromPrice === null
                        ? "尚未提供服務項目"
                        : `from ${formatMoney(card.fromPrice, config)}`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
