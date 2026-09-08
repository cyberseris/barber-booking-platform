import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";

import type { AuthOutletContext } from "@/hooks/use-authenticated-user";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/shop";

type AuthState =
  { status: "checking" } | { status: "anonymous" } | { status: "authenticated"; user: User };

/**
 * Client-side replacement for the `_authenticated` route's `beforeLoad` guard.
 * Without SSR the session check has to happen in the browser, so children render
 * only once Supabase has confirmed a user; otherwise we redirect to sign-in.
 *
 * It also loads the user's `profiles` row before rendering, so role-gated children
 * (the /shop surfaces) never flash the wrong page while the role is still unknown.
 */
export function ProtectedRoute() {
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setAuth(
        error || !data.user
          ? { status: "anonymous" }
          : { status: "authenticated", user: data.user },
      );
    });

    return () => {
      active = false;
    };
  }, []);

  const userId = auth.status === "authenticated" ? auth.user.id : null;

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data);
    setProfileLoaded(true);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void refreshProfile();
  }, [userId, refreshProfile]);

  // Neutral background rather than a spinner, so there's no flash of white
  // between the session check and the page.
  if (auth.status === "checking") {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  if (auth.status === "anonymous") {
    return <Navigate to="/sign-in" replace />;
  }

  if (!profileLoaded) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }

  return (
    <Outlet context={{ user: auth.user, profile, refreshProfile } satisfies AuthOutletContext} />
  );
}
