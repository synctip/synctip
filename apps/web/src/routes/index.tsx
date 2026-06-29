import { createFileRoute, Link } from "@tanstack/react-router";
import { Divide, History, Smartphone, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="space-y-8 pt-6">
        <div className="flex items-center gap-3">
          <img
            src="/synctip-mark.svg"
            alt="Synctip"
            className="h-12 w-12"
            width={48}
            height={48}
          />
          <span className="text-3xl font-semibold tracking-tight">Synctip</span>
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Close the shift. Everything else happens by itself.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Synctip turns the 20 minutes of after-shift paperwork into one tap.
          Hours, splits, envelopes, notifications - done while you're still
          taking off your apron.
        </p>
        <div className="flex">
          <Button asChild size="lg" className="w-full sm:w-auto sm:min-w-65">
            <Link to="/login">Start Now</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 className="text-3xl font-semibold tracking-tight">
            Built around one button.
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            Managers should manage people, not spreadsheets. Everything around
            the shift - the math, the messages, the records - happens the
            moment you close it.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={Sparkles}
            title="One tap to close"
            body="Press Close Shift. Synctip calculates hours, splits the tips, generates envelopes, and notifies the team. You go home."
          />
          <Feature
            icon={Divide}
            title="Splits without the math"
            body="Total tips divided by total hours. Every member sees their hours, the rate, and exactly how their share was calculated."
          />
          <Feature
            icon={Smartphone}
            title="Everyone knows, instantly"
            body="Staff get notified the moment an envelope is ready. No screenshots, no WhatsApp threads, no asking the manager."
          />
          <Feature
            icon={History}
            title="Every shift, traceable"
            body="Reports, envelopes, payouts - all kept and searchable. The audit trail your spreadsheet never had."
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
            Free to start. No credit card.
          </h2>
          <p className="mx-auto max-w-md text-muted-foreground">
            Sign up in seconds with your phone number or Google account. Bring
            your team in when you're ready.
          </p>
          <div className="flex justify-center">
            <Button asChild size="lg" className="min-w-55">
              <Link to="/login">Start Now</Link>
            </Button>
          </div>
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
