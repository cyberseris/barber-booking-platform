import { Navigate, Outlet } from "react-router";

import { useAuthContext } from "@/hooks/use-authenticated-user";
import { homePathForRole } from "@/lib/shop";

/**
 * Gates the /admin surfaces on `profiles.role === "admin"` — the database's own role.
 * This is UX only: the real enforcement is RLS + the admin-guarded RPCs (`is_admin()`),
 * so a non-admin who somehow reached the route could still read/write nothing.
 */
export function AdminRoute() {
  const context = useAuthContext();

  if (context.profile?.role !== "admin") {
    return <Navigate to={homePathForRole(context.profile?.role)} replace />;
  }

  return <Outlet context={context} />;
}
