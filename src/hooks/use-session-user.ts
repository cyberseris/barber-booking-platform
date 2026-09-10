import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export interface SessionUserState {
  /** The signed-in user, or null when signed out. */
  user: User | null;
  /**
   * True until the first session read settles. Headers should render neither
   * "Login" nor the signed-in controls while this is true — otherwise a signed-in
   * visitor sees "Login" flash before it corrects itself, which reads as a bug.
   */
  loading: boolean;
}

/**
 * The session on PUBLIC pages (`/`, `/barbers`, `/barbers/:id`).
 *
 * `useAuthenticatedUser()` is not usable here: it reads <ProtectedRoute />'s outlet
 * context, which only exists on gated routes. Public pages must read the session
 * themselves — and must SUBSCRIBE to it, not just read it once, so that signing in or
 * out in another tab (or navigating back after a redirect) updates the header instead
 * of leaving stale controls behind.
 */
export function useSessionUser(): SessionUserState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
