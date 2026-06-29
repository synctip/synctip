import { Outlet, createRootRoute, Link } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link
              to="/"
              className="transition-colors hover:text-primary"
              activeProps={{ className: "text-primary" }}
            >
              Home
            </Link>
            <Link
              to="/health"
              className="transition-colors hover:text-primary"
              activeProps={{ className: "text-primary" }}
            >
              Health
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Outlet />
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Synctip</span>
          <nav className="flex items-center gap-4">
            <Link
              to="/privacy"
              className="transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              Terms
            </Link>
          </nav>
        </div>
      </footer>
      <Toaster richColors position="top-right" />
      <TanStackRouterDevtools />
      <ReactQueryDevtools initialIsOpen={false} />
    </div>
  );
}
