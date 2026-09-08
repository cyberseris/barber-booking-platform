import type { User } from "@supabase/supabase-js";
import { useOutletContext } from "react-router";

import type { Profile } from "@/lib/shop";

/** Supplied by <ProtectedRoute /> to everything it renders. */
export interface AuthOutletContext {
  user: User;
  /** The user's `profiles` row — the single source of truth for role. */
  profile: Profile | null;
  /** Re-reads the profile row (after a role upgrade or a payout-settings save). */
  refreshProfile: () => Promise<void>;
}

/**
 * Everything <ProtectedRoute /> provides. Only valid inside a route nested under it,
 * which guarantees a user (and a settled profile read) before rendering.
 */
export function useAuthContext(): AuthOutletContext {
  return useOutletContext<AuthOutletContext>();
}

/** The signed-in user. */
export function useAuthenticatedUser(): User {
  return useAuthContext().user;
}

/**
 * The signed-in user's `profiles` row. Role checks read THIS, never `user_metadata.role`
 * — auth metadata is only what sign-up captured, while `profiles.role` is what the
 * database (and every RLS policy) actually gates on.
 */
export function useProfile(): Profile | null {
  return useAuthContext().profile;
}
