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
import AppHome from "@/pages/app-home";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// Wraps every page. ScrollRestoration replaces TanStack Router's
// `scrollRestoration: true`, and errorElement replaces the root
// route's errorComponent.
function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
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
      {
        element: <ProtectedRoute />,
        children: [{ path: "/app", element: <AppHome /> }],
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
