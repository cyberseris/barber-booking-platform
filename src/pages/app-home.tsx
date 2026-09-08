import { Link, useNavigate } from "react-router";

import { useAuthenticatedUser } from "@/hooks/use-authenticated-user";
import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/integrations/supabase/client";

export default function AppHome() {
  usePageMeta({
    title: "Barbers — Barberly",
    description: "Your Barberly home: browsing, booking and barber tools arrive next.",
    ogTitle: "Barbers — Barberly",
    ogDescription: "Your Barberly home.",
  });

  const user = useAuthenticatedUser();
  const navigate = useNavigate();
  const isShop = user.user_metadata?.["role"] === "shop";

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/sign-in", { replace: true });
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-4">
          <Link to="/" className="font-display text-2xl tracking-tight">
            Barberly
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Hi {user.email}</span>
            {isShop && (
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                barber
              </span>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="h-9 rounded-full border border-border px-4 text-sm font-medium transition hover:bg-secondary"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-24 text-center">
        <div className="animate-fade-up rounded-3xl border border-border bg-card p-10 shadow-card">
          <h1 className="text-3xl sm:text-4xl">
            {isShop ? "理髮師後台即將上線" : "附近的理髮師即將上線"}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {isShop
              ? "下一個里程碑會加上個人檔案、服務項目與排班管理。"
              : "下一個里程碑會加上瀏覽與預約功能。"}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {isShop
              ? "Your barber dashboard is coming soon — profile, services & schedule arrive in the next milestone."
              : "Barbers near you are coming soon — browse & booking arrive in the next milestone."}
          </p>
        </div>
      </main>
    </div>
  );
}
