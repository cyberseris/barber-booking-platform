# Barberly Connect

Build a SaaS landing page + authenticated app shell for Barberly, a barber /

hair-stylist booking marketplace where customers find a stylist and book an

appointment online — and where barbers list a profile and publish their

schedule. Targeted at people who want to discover a good barber and book a

slot in a few taps. The site is barber-centric: barbers are the product. A

barber offers services (Cut / Color / Perm / Beard) at a starting price;

"styles" are not separate listings.

Design language — match this reference look closely (a clean, modern,

editorial e-commerce marketplace):

- Warm beige / cream palette on near-white backgrounds, with a dark

near-black accent for buttons.

- Serif display headlines (refined fashion-editorial serif) paired with a

clean sans-serif body (Inter or similar). Generous whitespace, rounded

cards.

- Mobile responsive, tasteful subtle fade-in animations.

The site must include:

1. A public landing page (/) with, in this order:

    - Navbar: the wordmark "Barberly" top-left; a search field; and a dark

    rounded-pill "Login" button top-right. No other nav links in v1 (no

    Styles / Barbers / Book / Contact tabs — booking and barber browsing

    arrive in later milestones, and dead in-page anchors should not appear).

    - Hero: an eyebrow label "New Look", a big serif headline "Style with

    Confident Hair", two styled-hair / barber photos split left and right of

    the headline, and a centered search bar with placeholder "Find your

    stylist or search a style", plus filter chips: All / Cut / Color / Perm /

    Beard.

    - Trust logo strip: a horizontal row of partner-salon / brand logos

    directly under the hero.

    - Feature row (exactly 4 icon + label cells) under a heading "Best booking

    experience": Verified Barbers, Instant Booking, Secure Payment,

    Top-Rated Styles.

    - "Popular" grid: a heading "Popular" and a card grid of featured barbers

    (not styles). Each card shows a barber portrait, the barber's name, shop

    / location, a row of service chips (subset of Cut / Color / Perm /

    Beard), a star rating with review count, a "from $—" starting price, and

    a small "Popular" badge. Cards are clickable blocks with a hover lift

    (destination is a placeholder for v1).

    - Footer with copyright "© 2026 Barberly".

2. Authentication using Lovable's built-in Supabase-style auth (Lovable Cloud

    is fine for v1; we'll swap to a user-owned Supabase project later):

    - A combined Sign Up / Sign In page at /login with email + password.

    - On the Sign Up form, include a role selector as a TAB / segmented toggle

    at the top of the form with two options labeled "Customer" (role value

    customer) and "Barber" (role value shop). Default to Customer. Capture

    the choice in form state and pass it into the sign-up call's user

    metadata (options.data.role).

    - Sign Out functionality.

    - Email confirmation disabled for v1.

3. After signing in, land the user on /barbers, a simple authenticated shell:

    - A header with the Barberly wordmark on the left, and on the right: the

    greeting Hi {user.email}, then — only if the account's

    user_metadata.role === "shop" — a small rounded pill tag rendered next

    to the email reading "barber" (no tag is rendered for Customer

    accounts), then a Sign Out button.

    - Body content is role-aware:

    - Customer: 「附近的理髮師即將上線 — 下一個里程碑會加上瀏覽與預約功能。」 /

        "Barbers near you are coming soon — browse & booking arrive in the next

        milestone."

    - Barber: 「理髮師後台即將上線 — 下一個里程碑會加上個人檔案、服務項目與排班管理。」 /

        "Your barber dashboard is coming soon — profile, services & schedule

        arrive in the next milestone."

Out of scope for v1: the barber onboarding form, the barber / services /

schedule tables, the booking flow, payments, and any custom database tables

(do NOT create barbers / bookings / profiles tables yet — only use Supabase's

default auth.users; capture the chosen role in auth user metadata only). Those

come in later milestones. Stick to landing page + role-tab auth + the

role-aware /barbers placeholder shell.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4987a698-2930-4045-9fbe-b80d175aedf9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Stack

Plain **Vite + React** single-page app — no SSR, no server runtime, no platform
adapter. `vite build` emits a fully static bundle to `dist/`.

- React 19 + TypeScript
- [React Router](https://reactrouter.com) v7 for client-side routing
- Tailwind CSS v4 (via `@tailwindcss/vite`) + shadcn/ui components
- Supabase JS for auth (browser-side only)
- TanStack Query for data fetching

> This project previously ran on TanStack Start with SSR and a Cloudflare/nitro
> build target. That was removed in the migration to a static SPA: the server
> entry, the route tree, the server-only Supabase modules (service-role client,
> auth middleware, cron auth) and the wrangler config are all gone.

## Routes

| Path | Page |
| --- | --- |
| `/` | Public landing page |
| `/sign-in` | Combined auth page, Sign In tab |
| `/sign-up` | Combined auth page, Sign Up tab (customer / barber role toggle) |
| `/login` | Redirects to `/sign-in` (legacy path) |
| `/app` | Authenticated shell — role-aware placeholder (was `/barbers`) |
| anything else | 404 |

`/app` is guarded client-side by `<ProtectedRoute />`, which checks the Supabase
session in the browser and redirects to `/sign-in` when there is none.

Page titles and meta tags are set by the `usePageMeta` hook, the client-side
stand-in for TanStack Start's route `head()`. Site-wide defaults live in
`index.html`.

## Development

You need [Bun](https://bun.sh) (or Node.js + npm — the lockfile is Bun's).

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev        # http://localhost:8080
```

Other scripts: `bun run build`, `bun run preview`, `bun run typecheck`,
`bun run lint`, `bun run format`.

### Environment variables

Copy the `VITE_`-prefixed values into `.env`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

Vite inlines these at build time, so they must be present in the *build*
environment — not just at runtime.

## Deploying to Vercel

The app is a static SPA, so no serverless functions are involved.

- Build command: `vite build`
- Output directory: `dist`
- `vercel.json` rewrites every unmatched path to `/index.html`, so deep links
  such as `/app` are served the shell and resolved by React Router. Real files
  in `dist/` (assets, `favicon.ico`, `robots.txt`) are matched first and served
  directly.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the Vercel
  project's environment variables for every environment you build.
- Add the Vercel domain to the Supabase Auth allowed redirect URLs — sign-up
  uses `emailRedirectTo: window.location.origin`.
