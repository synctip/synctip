import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarRange, Coins, LineChart, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="space-y-6 pt-6">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Run your shifts and split your tips without the spreadsheet.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Synctip is the place your team plans the week, records what came in,
          and sees exactly what they earned - clearly, fairly, on time.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/login">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Four things, done well.
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            Everything Synctip does serves one of two goals: reduce friction, or
            make money clearer. If a feature does neither, it isn't here.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={CalendarRange}
            title="Plan shifts"
            body="Draft the week, publish to the team, and lock it when the shift is done. Everyone sees the same schedule."
          />
          <Feature
            icon={Coins}
            title="Split tips fairly"
            body="Cash, card, and POS in one place. Your splitting rules run automatically - and every member can see how their share was calculated."
          />
          <Feature
            icon={Users}
            title="Manage your team"
            body="Invite members by role per branch. Run multiple locations without losing track of who works where."
          />
          <Feature
            icon={LineChart}
            title="See the numbers"
            body="Tips by period, attendance, workload. Reports built for owners and managers - not for chart galleries."
          />
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative overflow-hidden rounded-2xl border bg-linear-to-br from-primary/10 via-card to-card p-10 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,var(--color-primary),transparent_60%)]/[15]"
        />
        <div className="relative space-y-5">
          <h2 className="text-3xl font-semibold tracking-tight">
            Ready when you are.
          </h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            Sign in with your phone number or Google account. Setup takes less
            than a minute.
          </p>
          <div className="flex justify-center">
            <Button asChild size="lg">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mx-auto max-w-md text-xs text-muted-foreground">
            Signing in shares your name, email, and profile picture from Google
            so we can create your Synctip account. Read our{" "}
            <Link
              to="/privacy"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
