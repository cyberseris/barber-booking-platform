import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuthContext } from "@/hooks/use-authenticated-user";
import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/integrations/supabase/client";

export default function AppHome() {
  usePageMeta({
    title: "Barbers — Barberly",
    description: "Your Barberly home: browsing, booking and barber tools arrive next.",
    ogTitle: "Barbers — Barberly",
    ogDescription: "Your Barberly home.",
  });

  const { user, profile, refreshProfile } = useAuthContext();
  const navigate = useNavigate();
  // Role comes from profiles.role — the column every RLS policy gates on — not from
  // user_metadata, which only records what the sign-up tab captured.
  const isShop = profile?.role === "shop";

  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/sign-in", { replace: true });
  }

  /**
   * Upgrade this customer to a shop. The write goes through the user's own session, so
   * RLS is what authorises it (a user may only update their own row, and the policy
   * rejects a role of 'admin' — that is promoted by a migration, never self-served).
   */
  async function handleBecomeShop() {
    setError(null);
    setUpgrading(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role: "shop" })
      .eq("id", user.id);

    if (updateError) {
      setUpgrading(false);
      setError(updateError.message);
      return;
    }

    await refreshProfile();
    setUpgrading(false);
    navigate("/shop", { replace: true });
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
            {isShop ? "理髮師後台已經開好了" : "附近的理髮師即將上線"}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {isShop
              ? "你可以開始建立理髮師檔案、服務項目與可預約時段。"
              : "下一個里程碑會加上瀏覽與預約功能。想開店接客嗎？"}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {isShop
              ? "Your shop tools are ready — add barbers, services and bookable slots."
              : "Browsing & booking are coming soon. Want to take bookings yourself?"}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {isShop ? (
              <>
                <Link
                  to="/shop"
                  className="h-12 rounded-full bg-primary px-7 text-sm font-medium leading-[3rem] text-primary-foreground transition hover:opacity-90"
                >
                  理髮店設定 / Shop settings
                </Link>
                <Link
                  to="/shop/bookings"
                  className="h-12 rounded-full border border-border px-7 text-sm font-medium leading-[3rem] transition hover:bg-secondary"
                >
                  服務與時段 / Services & slots
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={handleBecomeShop}
                disabled={upgrading}
                className="h-12 rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {upgrading ? "處理中…" : "開店 / Become a shop"}
              </button>
            )}
          </div>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        </div>
      </main>
    </div>
  );
}
