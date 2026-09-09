import { MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { BookDialog } from "@/components/book-dialog";
import { BrowseNav } from "@/components/browse-nav";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/integrations/supabase/client";
import { consecutiveRun, formatDay, formatTime, localTimeZoneLabel, photoUrl } from "@/lib/booking";
import { errMessage } from "@/lib/errors";
import {
  DEFAULT_PLATFORM_CONFIG,
  SERVICE_CATEGORY_LABELS,
  formatMoney,
  type Barber,
  type BarberPhoto,
  type BookableSlot,
  type PlatformConfig,
  type Service,
  type ServiceCategory,
} from "@/lib/shop";

/**
 * One barber, laid out like a marketplace product-detail page: the work photos lead,
 * then the profile, the service menu and the slots that are actually still open.
 *
 * "Still open" is DERIVED, never stored: `bookable_slots` has no status column, so a
 * slot is offered unless a `booking_slots` row references it (the NOT EXISTS anti-join,
 * done here as an `in` read of the barber's slot ids).
 */
export default function BarberDetail() {
  const { barberId } = useParams<{ barberId: string }>();
  const navigate = useNavigate();

  const [barber, setBarber] = useState<Barber | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [photos, setPhotos] = useState<BarberPhoto[]>([]);
  const [freeSlots, setFreeSlots] = useState<BookableSlot[]>([]);
  const [config, setConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [zoomed, setZoomed] = useState<BarberPhoto | null>(null);

  usePageMeta({
    title: barber ? `${barber.name} — Barberly` : "理髮師 — Barberly",
    description: barber?.intro ?? "See this barber's work and book a slot on Barberly.",
    ogTitle: barber ? `${barber.name} — Barberly` : "理髮師 — Barberly",
    ogDescription: barber?.intro ?? "See this barber's work and book a slot.",
  });

  /** Re-reads the slots and the held set — called after a booking so the run disappears. */
  const loadAvailability = useCallback(async () => {
    if (!barberId) return;

    const { data: slots, error: slotsError } = await supabase
      .from("bookable_slots")
      .select("*")
      .eq("barber_id", barberId)
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

    if (slotsError) {
      setError(errMessage(slotsError, "Could not load this barber's schedule."));
      return;
    }

    const slotIds = (slots ?? []).map((slot) => slot.id);
    if (slotIds.length === 0) {
      setFreeSlots([]);
      return;
    }

    // The anti-join: any slot with a booking_slots row is held by a live booking
    // (a cancelled booking's rows are deleted by the free-on-cancel trigger).
    const { data: held, error: heldError } = await supabase
      .from("booking_slots")
      .select("slot_id")
      .in("slot_id", slotIds);

    if (heldError) {
      setError(errMessage(heldError, "Could not check slot availability."));
      return;
    }

    const heldIds = new Set((held ?? []).map((row) => row.slot_id));
    setFreeSlots((slots ?? []).filter((slot) => !heldIds.has(slot.id)));
  }, [barberId]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!barberId) return;
      setLoading(true);

      const [barberResult, servicesResult, photosResult, settingsResult, userResult] =
        await Promise.all([
          supabase.from("barbers").select("*").eq("id", barberId).maybeSingle(),
          supabase.from("services").select("*").eq("barber_id", barberId).order("price"),
          supabase
            .from("barber_photos")
            .select("*")
            .eq("barber_id", barberId)
            .order("is_featured", { ascending: false })
            .order("sort_order", { ascending: true }),
          supabase.from("platform_settings").select("*").maybeSingle(),
          supabase.auth.getUser(),
        ]);

      if (!active) return;

      const failure = barberResult.error ?? servicesResult.error ?? photosResult.error;
      if (failure) {
        setError(errMessage(failure, "Could not load this barber."));
        setLoading(false);
        return;
      }

      setBarber(barberResult.data ?? null);
      setServices(servicesResult.data ?? []);
      setPhotos(photosResult.data ?? []);
      setSignedIn(Boolean(userResult.data.user));

      if (settingsResult.data) {
        setConfig({
          currency: settingsResult.data.currency,
          currencyMinorUnits: settingsResult.data.currency_minor_units,
          slotMinutes: settingsResult.data.slot_minutes,
        });
      }

      await loadAvailability();
      if (!active) return;
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, [barberId, loadAvailability]);

  /** The shortest service decides whether ANY start time is still offerable. */
  const smallestRequired = useMemo(
    () =>
      services.length > 0 ? Math.min(...services.map((service) => service.required_slots)) : 1,
    [services],
  );

  const bookableStarts = useMemo(
    () =>
      freeSlots.filter((_, index) => consecutiveRun(freeSlots, index, smallestRequired) !== null),
    [freeSlots, smallestRequired],
  );

  function handleBookClick() {
    if (signedIn === false) {
      // Route names differ per build — this one signs in at /sign-in (there is no /login).
      navigate("/sign-in");
      return;
    }
    setBookOpen(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream">
        <BrowseNav />
        <main className="mx-auto max-w-5xl px-5 py-16">
          <p className="text-sm text-muted-foreground">載入中…</p>
        </main>
      </div>
    );
  }

  if (!barber) {
    return (
      <div className="min-h-screen bg-cream">
        <BrowseNav />
        <main className="mx-auto max-w-5xl px-5 py-16">
          <h1 className="text-2xl">找不到這位理髮師</h1>
          <Link to="/barbers" className="mt-4 inline-block text-sm underline">
            回到理髮師列表
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <BrowseNav />

      <main className="mx-auto max-w-5xl px-5 py-10">
        <Link to="/barbers" className="text-sm text-muted-foreground underline">
          ← 所有理髮師
        </Link>

        <section className="mt-6">
          {photos.length === 0 ? (
            <div className="flex aspect-16/9 items-center justify-center rounded-3xl border border-border bg-secondary text-sm text-muted-foreground">
              這位理髮師還沒有上傳作品照
            </div>
          ) : (
            <Carousel className="w-full">
              <CarouselContent>
                {photos.map((photo) => (
                  <CarouselItem key={photo.id}>
                    <button
                      type="button"
                      onClick={() => setZoomed(photo)}
                      className="block w-full cursor-zoom-in overflow-hidden rounded-3xl border border-border bg-secondary"
                    >
                      <img
                        src={photoUrl(photo.storage_path)}
                        alt={photo.caption ?? `${barber.name} 的作品`}
                        className="aspect-16/9 w-full object-cover"
                      />
                    </button>
                    {photo.caption && (
                      <p className="mt-2 text-center text-sm text-muted-foreground">
                        {photo.caption}
                      </p>
                    )}
                  </CarouselItem>
                ))}
              </CarouselContent>
              {photos.length > 1 && (
                <>
                  <CarouselPrevious className="left-3" />
                  <CarouselNext className="right-3" />
                </>
              )}
            </Carousel>
          )}

          {photos.length > 1 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {photos.length} 張作品照 · 點圖可放大
            </p>
          )}
        </section>

        <section className="mt-10 flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="font-display text-4xl">{barber.name}</h1>
            {barber.address && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" aria-hidden="true" />
                {barber.address}
              </p>
            )}
            {barber.intro && (
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                {barber.intro}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleBookClick}
            disabled={services.length === 0 || bookableStarts.length === 0}
            className="h-12 rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            預約 Book
          </button>
        </section>

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        <section className="mt-12 grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-xl">服務項目 / Services</h2>
            {services.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">尚未提供服務項目。</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {services.map((service) => (
                  <li
                    key={service.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4"
                  >
                    <div>
                      <p className="text-sm font-medium">{service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {SERVICE_CATEGORY_LABELS[service.category as ServiceCategory] ??
                          service.category}{" "}
                        · {service.required_slots * config.slotMinutes} 分鐘
                      </p>
                    </div>
                    <p className="text-sm font-medium">{formatMoney(service.price, config)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="text-xl">可預約時段 / Available slots</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              時間以你所在時區顯示（{localTimeZoneLabel()}）。
            </p>
            {freeSlots.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">目前沒有可預約的時段。</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {freeSlots.slice(0, 24).map((slot) => (
                  <span
                    key={slot.id}
                    className="rounded-xl border border-border bg-card px-3 py-2 text-xs"
                  >
                    {formatDay(slot.starts_at)} {formatTime(slot.starts_at)}
                  </span>
                ))}
                {freeSlots.length > 24 && (
                  <span className="self-center text-xs text-muted-foreground">
                    還有 {freeSlots.length - 24} 個時段…
                  </span>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <BookDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        barberName={barber.name}
        services={services}
        freeSlots={freeSlots}
        config={config}
      />

      <Dialog open={zoomed !== null} onOpenChange={(open) => !open && setZoomed(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle className="sr-only">
            {zoomed?.caption ?? `${barber.name} 的作品`}
          </DialogTitle>
          {zoomed && (
            <img
              src={photoUrl(zoomed.storage_path)}
              alt={zoomed.caption ?? `${barber.name} 的作品`}
              className="w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
