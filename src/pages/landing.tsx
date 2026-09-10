import {
  CalendarCheck,
  Clock,
  Lock,
  MapPin,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import heroLeft from "@/assets/hero-left.jpg";
import heroRight from "@/assets/hero-right.jpg";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useSessionUser } from "@/hooks/use-session-user";
import { supabase } from "@/integrations/supabase/client";
import { featuredBarbers, type Service } from "@/lib/barbers-data";

const filters: Array<"All" | Service> = ["All", "Cut", "Color", "Perm", "Beard"];

const partners = ["MAISON BLANC", "FOLD STUDIO", "ATELIER NINE", "NORTH LIGHT", "CURL THEORY"];

const quickLinks = [
  {
    icon: Clock,
    label: "Open daily",
    detail: "10:00 – 20:00 · walk-ins welcome",
    to: "/sign-up",
  },
  {
    icon: CalendarCheck,
    label: "Book online, any hour",
    detail: "Confirm a slot in under a minute",
    to: "/sign-up",
  },
  {
    icon: MapPin,
    label: "Find a shop nearby",
    detail: "Brooklyn · Chelsea · SoHo & more",
    to: "/sign-up",
  },
  {
    icon: Scissors,
    label: "First time here?",
    detail: "See how Barberly booking works",
    to: "/sign-up",
  },
];

const features = [
  {
    icon: ShieldCheck,
    label: "Verified Barbers",
    detail: "Every barber is licence-checked before a single slot goes live.",
  },
  {
    icon: Zap,
    label: "Instant Booking",
    detail: "Real openings, confirmed on the spot — no phone tag, no waiting.",
  },
  {
    icon: Lock,
    label: "Secure Payment",
    detail: "Card details are handled by our payment provider, never stored by us.",
  },
  {
    icon: Sparkles,
    label: "Top-Rated Styles",
    detail: "Ratings come only from customers who actually sat in the chair.",
  },
];

export default function Landing() {
  usePageMeta({
    title: "Barberly — Style with Confident Hair",
    description:
      "Find a verified barber or stylist near you and book a cut, color, perm or beard trim in a few taps. Barberly is the booking marketplace built around barbers.",
    ogTitle: "Barberly — Style with Confident Hair",
    ogDescription: "Find a verified barber or stylist near you and book in a few taps.",
  });

  const [activeFilter, setActiveFilter] = useState<"All" | Service>("All");
  const [query, setQuery] = useState("");
  // The landing page is public, so it must read the session itself. Without this the
  // header rendered a hard-coded "Login" no matter who was signed in.
  const { user, loading: sessionLoading } = useSessionUser();

  // Signed-in visitors browse real barbers; signed-out ones are still funnelled to sign-up.
  const barberCardHref = user ? "/barbers" : "/sign-up";

  async function handleSignOut() {
    // Stay on the landing page — useSessionUser's subscription swaps the header back.
    await supabase.auth.signOut();
  }

  const visible =
    activeFilter === "All"
      ? featuredBarbers
      : featuredBarbers.filter((b) => b.services.includes(activeFilter));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4">
          <Link to="/" className="font-display text-2xl tracking-tight">
            Barberly
          </Link>
          <span className="ml-6 hidden items-center gap-2 text-xs tracking-wide text-muted-foreground lg:flex">
            <Clock className="size-3.5" />
            Open daily 10:00 – 20:00
          </span>
          <div className="relative ml-auto hidden max-w-xs flex-1 items-center sm:flex">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search barbers"
              placeholder="Search"
              className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-4 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="ml-auto flex items-center gap-3 sm:ml-0">
            {/* Render neither state until the session settles, so a signed-in visitor
                never sees "Login" flash before it corrects itself. */}
            {sessionLoading ? (
              <span aria-hidden className="h-10 w-24 rounded-full bg-secondary/60" />
            ) : user ? (
              <>
                <Link
                  to="/bookings"
                  className="hidden h-10 items-center rounded-full px-4 text-sm font-medium transition hover:bg-secondary sm:inline-flex"
                >
                  我的預約
                </Link>
                <span className="hidden text-sm text-muted-foreground lg:inline">{user.email}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium transition hover:bg-secondary"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/sign-in"
                className="inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero — warm ground, statement left, portrait panel right */}
        <section className="relative overflow-hidden bg-cream">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-sand/50 blur-3xl"
          />
          <div className="relative mx-auto max-w-6xl px-5 pt-14 pb-44 sm:pt-20 sm:pb-52">
            <div className="grid items-center gap-12 md:grid-cols-[1.05fr_0.95fr]">
              <div className="animate-fade-up">
                <span className="inline-block rounded-full border border-sand bg-background/70 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  New Look
                </span>
                <h1 className="mt-6 text-5xl leading-[1.05] sm:text-6xl">
                  Style with <em className="italic text-clay">Confident</em> Hair
                </h1>
                <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
                  Barberly is the calm way to book a barber. Browse verified stylists near you, see
                  the openings they actually have, and confirm your chair in a few taps.
                </p>

                <div className="mt-8 max-w-md">
                  <div className="relative flex items-center">
                    <Search className="pointer-events-none absolute left-5 size-4 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      type="search"
                      aria-label="Find your stylist or search a style"
                      placeholder="Find your stylist or search a style"
                      className="h-14 w-full rounded-full border border-border bg-card pl-12 pr-4 text-sm shadow-card outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {filters.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setActiveFilter(f)}
                        aria-pressed={activeFilter === f}
                        className={`h-9 rounded-full border px-4 text-sm transition ${
                          activeFilter === f
                            ? "border-transparent bg-primary text-primary-foreground"
                            : "border-sand bg-background/60 text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="animate-fade-up relative mx-auto w-full max-w-sm md:max-w-none">
                <img
                  src={heroRight}
                  alt="Woman with glossy, freshly styled brown hair"
                  width={800}
                  height={1008}
                  className="ml-auto h-[26rem] w-full rounded-[2rem] object-cover shadow-card sm:h-[32rem]"
                />
                <img
                  src={heroLeft}
                  alt="Man in dark sunglasses with sharp cornrow braids and a lined-up beard"
                  width={800}
                  height={1008}
                  loading="lazy"
                  className="absolute -bottom-8 -left-2 hidden h-40 w-32 rounded-2xl border-4 border-cream object-cover shadow-lift sm:block md:h-48 md:w-36"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Quick links — practical entry points, lifted over the hero edge */}
        <section aria-label="Quick links" className="relative z-10 -mt-32 sm:-mt-36">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border shadow-card sm:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map(({ icon: Icon, label, detail, to }) => (
                <Link
                  key={label}
                  to={to}
                  className="group flex items-start gap-4 bg-card px-6 py-7 transition hover:bg-cream"
                >
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-wood transition group-hover:bg-sand">
                    <Icon className="size-[18px]" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {detail}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section
          aria-label="Partner salons"
          className="mt-24 border-y border-border/50 bg-cream sm:mt-28"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-5 py-7">
            {partners.map((p) => (
              <span
                key={p}
                className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground"
              >
                {p}
              </span>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <div className="max-w-xl">
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-clay">
              Why Barberly
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl">Best booking experience</h2>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, label, detail }) => (
              <div key={label}>
                <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-wood">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg">{label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Popular */}
        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.22em] text-clay">
                Featured barbers
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl">Popular</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {visible.length} {visible.length === 1 ? "barber" : "barbers"}
              {activeFilter === "All" ? "" : ` for ${activeFilter}`}
            </span>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((b) => (
              <Link
                key={b.id}
                to={barberCardHref}
                className="group block overflow-hidden rounded-[1.75rem] border border-border bg-card transition duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="relative">
                  <img
                    src={b.image}
                    alt={`${b.name}, barber at ${b.shop}`}
                    width={700}
                    height={800}
                    loading="lazy"
                    className="h-64 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-[11px] font-medium uppercase tracking-wider">
                    Popular
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="text-xl">{b.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{b.shop}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {b.services.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-sand px-3 py-1 text-xs text-secondary-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
                    <span className="flex items-center gap-1.5 text-sm">
                      <Star className="size-4 fill-clay text-clay" />
                      {b.rating.toFixed(1)}
                      <span className="text-muted-foreground">({b.reviews})</span>
                    </span>
                    <span className="text-sm font-medium">from ${b.fromPrice}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-cream">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="font-display text-xl">Barberly</span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The booking marketplace built around barbers — verified chairs, real openings, no
              phone tag.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium">Opening hours</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Mon – Sun 10:00 – 20:00
              <br />
              Online booking open 24/7
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium">Areas</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Brooklyn · Chelsea · SoHo
              <br />
              Williamsburg · Astoria · Hoboken
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium">Get started</h3>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {user ? (
                <>
                  <Link
                    to="/barbers"
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    瀏覽理髮師
                  </Link>
                  <Link
                    to="/bookings"
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    我的預約
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/sign-up"
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    Create an account
                  </Link>
                  <Link
                    to="/sign-in"
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    Sign in
                  </Link>
                </>
              )}
              <Link
                to="/sign-up"
                className="text-muted-foreground transition hover:text-foreground"
              >
                List your shop
              </Link>
            </div>
          </div>
        </div>
        <div className="border-t border-border/60">
          <p className="mx-auto max-w-6xl px-5 py-6 text-center text-sm text-muted-foreground">
            © 2026 Barberly
          </p>
        </div>
      </footer>
    </div>
  );
}
