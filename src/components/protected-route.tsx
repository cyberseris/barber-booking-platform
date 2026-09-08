import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";

import type { AuthOutletContext } from "@/hooks/use-authenticated-user";
import { supabase } from "@/integrations/supabase/client";

type AuthState =
  { status: "checking" } | { status: "anonymous" } | { status: "authenticated"; user: User };

/**
 * Client-side replacement for the `_authenticated` route's `beforeLoad` guard.
 * Without SSR the session check has to happen in the browser, so children render
 * only once Supabase has confirmed a user; otherwise we redirect to sign-in.
 */
export function ProtectedRoute() {
  const [state, setState] = useState<AuthState>({ status: "checking" });

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setState(
        error || !data.user
          ? { status: "anonymous" }
          : { status: "authenticated", user: data.user },
      );
    });

    return () => {
      active = false;
    };
  }, []);

  if (state.status === "checking") {
    // Neutral background rather than a spinner, so there's no flash of white
    // between the session check and the page.
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  if (state.status === "anonymous") {
    return <Navigate to="/sign-in" replace />;
  }

  return <Outlet context={{ user: state.user } satisfies AuthOutletContext} />;
}
