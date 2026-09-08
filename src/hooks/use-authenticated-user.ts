import type { User } from "@supabase/supabase-js";
import { useOutletContext } from "react-router";

/** Supplied by <ProtectedRoute /> to everything it renders. */
export interface AuthOutletContext {
  user: User;
}

/**
 * The signed-in user. Only valid inside a route nested under <ProtectedRoute />,
 * which guarantees a user before rendering — the same guarantee the old
 * `_authenticated` route context gave.
 */
export function useAuthenticatedUser(): User {
  return useOutletContext<AuthOutletContext>().user;
}
