import { Link, NavLink, useNavigate } from "react-router";

import { supabase } from "@/integrations/supabase/client";

const linkBase = "h-9 rounded-full px-4 text-sm font-medium leading-9 transition";

/** Shared header for the /shop surfaces. */
export function ShopNav({ email }: { email: string | undefined }) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/sign-in", { replace: true });
  }

  return (
    <header className="border-b border-border/60 bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-5 py-4">
        <Link to="/" className="mr-2 font-display text-2xl tracking-tight">
          Barberly
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink
            to="/shop"
            end
            className={({ isActive }) =>
              `${linkBase} ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`
            }
          >
            理髮店設定
          </NavLink>
          <NavLink
            to="/shop/bookings"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`
            }
          >
            服務與時段
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {email && <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>}
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            barber
          </span>
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
  );
}
