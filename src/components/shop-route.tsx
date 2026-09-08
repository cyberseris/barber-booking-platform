import { Navigate, Outlet } from "react-router";

import { useAuthContext } from "@/hooks/use-authenticated-user";
import { homePathForRole } from "@/lib/shop";

/**
 * Gates the /shop surfaces on `profiles.role === "shop"` — the database's own role,
 * not `user_metadata`. A customer who lands here is sent back to their home page,
 * where the "Become a shop" button is the supported way in.
 */
export function ShopRoute() {
  const context = useAuthContext();

  if (context.profile?.role !== "shop") {
    return <Navigate to={homePathForRole(context.profile?.role)} replace />;
  }

  return <Outlet context={context} />;
}
