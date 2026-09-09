import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";

import { supabase } from "@/integrations/supabase/client";

const linkBase = "h-9 rounded-full px-4 text-sm font-medium leading-9 transition";

/**
 * Header for the customer-facing surfaces (/barbers, /barbers/:id, /bookings).
 *
 * Browsing is public, so this reads the session itself rather than relying on
 * <ProtectedRoute />'s context — the same header works signed in or out.
 */
export function BrowseNav() {
  const [user, setUser] = useState<User | null>(null);
  // Browsing is public, so this page has no <ProtectedRoute /> profile — read the role
  // directly, only to decide whether to show the admin-only Payouts link (defense in
  // depth; the real gate is <AdminRoute /> + RLS on /admin/payouts itself).
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!user) {
      setIsAdmin(false);
      return;
    }

    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsAdmin(data?.role === "admin");
      });

    return () => {
      active = false;
    };
  }, [user]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/sign-in", { replace: true });
  }

  return (
    <header className="border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 py-4">
        <Link to="/" className="mr-2 font-display text-2xl tracking-tight">
          Barberly
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink
            to="/barbers"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`
            }
          >
            瀏覽理髮師
          </NavLink>
          {user && (
            <NavLink
              to="/bookings"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`
              }
            >
              我的預約
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to="/admin/payouts"
              className={({ isActive }) =>
                `${linkBase} ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`
              }
            >
              撥款管理 Payouts
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="h-9 rounded-full border border-border px-4 text-sm font-medium transition hover:bg-secondary"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/sign-in"
              className="h-9 rounded-full bg-primary px-5 text-sm font-medium leading-9 text-primary-foreground transition hover:opacity-90"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
