import { useEffect } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient, useSession } from "@/lib/auth-client";
import { ConnectionsCard } from "@/components/connections-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DashboardSearch = {
  // Populated by Better-Auth's OAuth error callback (see ConnectionsCard's
  // linkSocial errorCallbackURL). Without an explicit validator here,
  // TanStack Router strips unknown params before our effect can read them.
  error?: string;
};

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  beforeLoad: async () => {
    const { data } = await authClient.getSession();
    if (!data) {
      throw redirect({ to: "/login" });
    }
  },
  component: DashboardPage,
});

// Map Better-Auth OAuth/link error codes to user-facing messages. Anything not
// listed here falls back to a generic message including the raw code, so we
// still surface it without leaking implementation noise.
const LINK_ERROR_MESSAGES: Record<string, string> = {
  account_already_linked_to_different_user:
    "This Google account is already connected to another Synctip account. If it’s yours, sign in with Google directly. Merging accounts will be supported soon.",
  user_already_has_account_with_this_provider:
    "This sign-in method is already connected to your account.",
};

function DashboardPage() {
  const { data: session, refetch } = useSession();
  const { error } = Route.useSearch();
  const navigate = useNavigate();
  const user = session?.user;

  // Account-link flows (e.g. Google OAuth from ConnectionsCard) redirect back
  // here on failure with `?error=<code>`. Surface it as a toast, then strip
  // the param so a refresh doesn't re-trigger.
  useEffect(() => {
    if (!error) return;
    const message =
      LINK_ERROR_MESSAGES[error] ?? `Could not link account (${error}).`;
    toast.error(message);
    void navigate({ to: "/dashboard", search: {}, replace: true });
  }, [error, navigate]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage how you sign in to Synctip.
        </p>
      </div>

      <ConnectionsCard
        user={{
          // Both fields come from the phoneNumber plugin's user-table additions.
          phoneNumber: (user as { phoneNumber?: string | null }).phoneNumber,
          phoneNumberVerified: (
            user as { phoneNumberVerified?: boolean | null }
          ).phoneNumberVerified,
        }}
        onChanged={() => refetch()}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your session</CardTitle>
          <CardDescription>From Better-Auth</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
            {JSON.stringify(user, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
