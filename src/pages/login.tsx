import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import heroRight from "@/assets/hero-right.jpg";
import { usePageMeta } from "@/hooks/use-page-meta";
import { supabase } from "@/integrations/supabase/client";
import { homePathForRole } from "@/lib/shop";

type Role = "customer" | "shop";
type Mode = "signup" | "signin";

const PATH_FOR_MODE: Record<Mode, string> = {
  signin: "/sign-in",
  signup: "/sign-up",
};

export default function Login() {
  usePageMeta({
    title: "Sign in or sign up — Barberly",
    description:
      "Create your Barberly account as a customer or as a barber, or sign in to manage your bookings.",
    ogTitle: "Sign in or sign up — Barberly",
    ogDescription: "Create a Barberly account as a customer or a barber.",
  });

  const navigate = useNavigate();
  const location = useLocation();
  // The URL is the source of truth for which tab is showing, so /sign-in and
  // /sign-up are both real, linkable pages.
  const mode: Mode = location.pathname === PATH_FOR_MODE.signup ? "signup" : "signin";

  const [role, setRole] = useState<Role>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Send the user to the page their role belongs on. The branch reads `profiles.role`
   * (the row the signup trigger created), not the tab that was clicked, so an existing
   * account always lands in the right place. Shop and customer are the only branches:
   * no admin can be signed in at this point in the course.
   */
  const goToRoleHome = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      navigate(homePathForRole(null), { replace: true });
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    navigate(homePathForRole(profile?.role), { replace: true });
  }, [navigate]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goToRoleHome();
    });
  }, [goToRoleHome]);

  function switchMode(next: Mode) {
    setError(null);
    navigate(PATH_FOR_MODE[next], { replace: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { role },
              // Same role branch as the post-sign-in redirect, using the chosen tab
              // (there is no profiles row to read until the signup trigger fires).
              emailRedirectTo: `${window.location.origin}${homePathForRole(role)}`,
            },
          })
        : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (result.data.session) {
      await goToRoleHome();
    } else {
      navigate(PATH_FOR_MODE.signin, { replace: true });
      setError("Account created. Please sign in.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="mx-auto w-full max-w-6xl px-5 py-6">
        <Link to="/" className="font-display text-2xl tracking-tight">
          Barberly
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 px-5 pb-20 pt-4 lg:grid-cols-2">
        <aside className="hidden lg:block">
          <img
            src={heroRight}
            alt=""
            width={800}
            height={1008}
            className="h-[28rem] w-full rounded-[2rem] object-cover shadow-card"
          />
          <p className="mt-7 max-w-sm font-display text-2xl leading-snug">
            Book the chair, not the phone call.
          </p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Verified barbers, real openings, and a booking that takes under a minute.
          </p>
        </aside>

        <div className="animate-fade-up mx-auto w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-card lg:mx-0">
          <h1 className="text-center text-3xl">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {mode === "signup"
              ? "Join Barberly as a customer or as a barber."
              : "Sign in to continue booking."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {mode === "signup" && (
              <div
                role="tablist"
                aria-label="Account type"
                className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1"
              >
                {(
                  [
                    { value: "customer", label: "Customer" },
                    { value: "shop", label: "Barber" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={role === tab.value}
                    onClick={() => setRole(tab.value)}
                    className={`h-10 rounded-full text-sm font-medium transition ${
                      role === tab.value
                        ? "bg-primary text-primary-foreground"
                        : "text-secondary-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-foreground/30 focus:ring-2 focus:ring-ring/30"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-full bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "signup" ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New to Barberly?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
              className="font-medium text-foreground underline underline-offset-4"
            >
              {mode === "signup" ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
