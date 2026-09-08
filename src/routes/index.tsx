import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, ShieldCheck, Zap, Lock, Sparkles, Star } from "lucide-react";

import heroLeft from "@/assets/hero-left.jpg";
import heroRight from "@/assets/hero-right.jpg";
import { featuredBarbers, type Service } from "@/lib/barbers-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barberly — Style with Confident Hair" },
      {
        name: "description",
        content:
          "Find a verified barber or stylist near you and book a cut, color, perm or beard trim in a few taps. Barberly is the booking marketplace built around barbers.",
      },
      { property: "og:title", content: "Barberly — Style with Confident Hair" },
      {
        property: "og:description",
        content: "Find a verified barber or stylist near you and book in a few taps.",
      },
    ],
  }),
  component: Landing,
});

const filters: Array<"All" | Service> = ["All", "Cut", "Color", "Perm", "Beard"];

const partners = ["MAISON BLANC", "FOLD STUDIO", "ATELIER NINE", "NORTH LIGHT", "CURL THEORY"];

const features = [
  { icon: ShieldCheck, label: "Verified Barbers" },
  { icon: Zap, label: "Instant Booking" },
  { icon: Lock, label: "Secure Payment" },
  { icon: Sparkles, label: "Top-Rated Styles" },
];

function Landing() {
  const [activeFilter, setActiveFilter] = useState<"All" | Service>("All");
  const [query, setQuery] = useState("");

  const visible =
    activeFilter === "All"
      ? featuredBarbers
      : featuredBarbers.filter((b) => b.services.includes(activeFilter));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-4">
          <Link to="/" className="font-display text-2xl tracking-tight">
            Barberly
          </Link>
          <div className="relative ml-auto hidden max-w-xs flex-1 items-center sm:flex">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <input
              type="search"
              aria-label="Search barbers"
              placeholder="Search"
              className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-4 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <Link
            to="/login"
            className="ml-auto inline-flex h-10 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90 sm:ml-0"
          >
            Login
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pt-12 pb-16 sm:pt-20">
          <div className="animate-fade-up text-center">
            <span className="inline-block rounded-full bg-secondary px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-secondary-foreground">
              New Look
            </span>
          </div>

          <div className="mt-10 grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto_1fr]">
            <img
              src={heroLeft}
              alt="Man with sharp cornrow braids and a lined-up beard"
              width={800}
              height={1008}
              className="animate-fade-up mx-auto h-56 w-full max-w-xs rounded-3xl object-cover shadow-card md:h-72"
            />
            <h1 className="animate-fade-up mx-auto max-w-md text-center text-5xl leading-[1.05] sm:text-6xl">
              Style with <em className="italic text-clay">Confident</em> Hair
            </h1>
            <img
              src={heroRight}
              alt="Woman with glossy styled hair"
              width={800}
              height={1008}
              loading="lazy"
              className="animate-fade-up mx-auto h-56 w-full max-w-xs rounded-3xl object-cover shadow-card md:h-72"
            />
          </div>

          <div className="animate-fade-up mx-auto mt-12 max-w-xl">
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
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  aria-pressed={activeFilter === f}
                  className={`h-9 rounded-full border px-4 text-sm transition ${
                    activeFilter === f
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section aria-label="Partner salons" className="border-y border-border/60 bg-cream">
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
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <h2 className="text-center text-3xl sm:text-4xl">Best booking experience</h2>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {features.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card px-4 py-8 text-center"
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-secondary">
                  <Icon className="size-5 text-secondary-foreground" />
                </span>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Popular */}
        <section className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="text-3xl sm:text-4xl">Popular</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((b) => (
              <Link
                key={b.id}
                to="/login"
                className="group block overflow-hidden rounded-3xl border border-border bg-card shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift"
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
                <div className="p-5">
                  <h3 className="text-xl">{b.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{b.shop}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {b.services.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
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
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 py-10 text-center">
          <span className="font-display text-xl">Barberly</span>
          <p className="text-sm text-muted-foreground">© 2026 Barberly</p>
        </div>
      </footer>
    </div>
  );
}
