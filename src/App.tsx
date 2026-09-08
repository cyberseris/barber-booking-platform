import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Navigate,
  Outlet,
  RouterProvider,
  ScrollRestoration,
  createBrowserRouter,
} from "react-router";

import { ErrorPage } from "@/components/error-page";
import { ProtectedRoute } from "@/components/protected-route";
import { ShopRoute } from "@/components/shop-route";
import { Toaster } from "@/components/ui/sonner";
import AppHome from "@/pages/app-home";
import BarberDetail from "@/pages/barber-detail";
import Barbers from "@/pages/barbers";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import MyBookings from "@/pages/my-bookings";
import NotFound from "@/pages/not-found";
import ShopBookings from "@/pages/shop-bookings";
import ShopOnboarding from "@/pages/shop-onboarding";

const queryClient = new QueryClient();

// Wraps every page. ScrollRestoration replaces TanStack Router's
// `scrollRestoration: true`, and errorElement replaces the root
// route's errorComponent.
function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
      <Toaster position="top-center" />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: "/", element: <Landing /> },
      // One page, two URLs: the path picks which tab opens.
      { path: "/sign-in", element: <Login /> },
      { path: "/sign-up", element: <Login /> },
      // Legacy path from the TanStack Start build.
      { path: "/login", element: <Navigate to="/sign-in" replace /> },
      // Browsing barbers is public — you only need an account to book.
      { path: "/barbers", element: <Barbers /> },
      { path: "/barbers/:barberId", element: <BarberDetail /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: "/app", element: <AppHome /> },
          { path: "/bookings", element: <MyBookings /> },
          // Everything under here additionally requires profiles.role === "shop".
          {
            element: <ShopRoute />,
            children: [
              { path: "/shop", element: <ShopOnboarding /> },
              { path: "/shop/bookings", element: <ShopBookings /> },
            ],
          },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
