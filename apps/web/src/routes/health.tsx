import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type {
  EnvironmentTier,
  HealthCheck,
  HealthResponse,
  HealthStatus,
} from "@synctip/api-client";
import { ApiError } from "@synctip/api-client";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { api } from "../lib/api";

export const Route = createFileRoute("/health")({
  component: HealthPage,
});

const REFRESH_MS = 10_000;

function HealthPage() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => api.health.check({ signal }),
    refetchInterval: REFRESH_MS,
  });

  return (
    <main
      className="mx-auto w-full max-w-3xl space-y-6 p-6"
      aria-busy={query.isFetching}
    >
      <PageHeader
        data={query.data}
        isFetching={query.isFetching}
        onRefresh={() => query.refetch()}
      />

      <div aria-live="polite" aria-atomic="true">
        {query.isPending && (
          <Card>
            <CardContent className="text-muted-foreground text-sm">
              Loading…
            </CardContent>
          </Card>
        )}

        {query.isError && (
          <Card className="border-destructive/40">
            <CardContent className="text-destructive text-sm" role="alert">
              Failed to reach API: {formatError(query.error)}
            </CardContent>
          </Card>
        )}

        {query.data && <HealthReport data={query.data} />}
      </div>

      <p className="text-muted-foreground text-xs">
        Auto-refreshes every {REFRESH_MS / 1000}s
        {query.isFetching && query.data ? " · refreshing…" : ""}
      </p>
    </main>
  );
}

function PageHeader({
  data,
  isFetching,
  onRefresh,
}: {
  data: HealthResponse | undefined;
  isFetching: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="mr-auto text-2xl font-semibold tracking-tight">
        API health
      </h1>
      {data?.status && <StatusBadge status={data.status} />}
      {data?.tier && <TierBadge tier={data.tier} />}
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isFetching}
        aria-label="Refresh"
      >
        <RefreshCw className={cn(isFetching && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );
}

function HealthReport({ data }: { data: HealthResponse }) {
  const checks = Object.entries(data.checks ?? {}).flatMap(([name, list]) =>
    list.map((c, i) => ({ key: `${name}-${i}`, name, check: c })),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>{data.serviceId ?? "service"}</span>
            {data.version && (
              <span className="text-muted-foreground text-sm font-normal">
                v{data.version}
              </span>
            )}
            {data.releaseId && (
              <span className="text-muted-foreground font-mono text-xs font-normal">
                build {data.releaseId}
              </span>
            )}
          </CardTitle>
          {data.description && (
            <CardDescription>{data.description}</CardDescription>
          )}
        </CardHeader>

        {(data.notes?.length || data.output) && (
          <CardContent className="space-y-3">
            {data.notes && data.notes.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {data.notes.map((n) => (
                  <li
                    key={n}
                    className="bg-muted text-muted-foreground rounded px-2 py-0.5 font-mono text-xs"
                  >
                    {n}
                  </li>
                ))}
              </ul>
            )}
            {data.output && (
              <pre className="bg-destructive/10 text-destructive rounded-md p-3 text-xs whitespace-pre-wrap">
                {data.output}
              </pre>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Components</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
                <th className="px-6 py-2 font-medium">Component</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-6 py-2 font-medium">Observed</th>
              </tr>
            </thead>
            <tbody>
              {checks.map(({ key, name, check }) => (
                <CheckRow key={key} name={name} check={check} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function CheckRow({ name, check }: { name: string; check: HealthCheck }) {
  const status = check.status ?? "pass";
  const hasError = !!check.output && status !== "pass";

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="px-6 py-3">
          <code className="font-mono text-sm">{name}</code>
          {check.componentId && (
            <span className="text-muted-foreground ml-1.5 text-xs">
              · {check.componentId}
            </span>
          )}
          {check.componentType && (
            <span className="text-muted-foreground/70 ml-1 text-xs">
              ({check.componentType})
            </span>
          )}
        </td>
        <td className="px-3 py-3">
          <StatusBadge status={status} />
        </td>
        <td className="px-3 py-3 tabular-nums">{formatValue(check)}</td>
        <td className="text-muted-foreground px-6 py-3 text-xs tabular-nums">
          {check.time ? new Date(check.time).toLocaleTimeString() : "—"}
        </td>
      </tr>
      {hasError && (
        <tr className="border-b last:border-0">
          <td colSpan={4} className="px-6 pb-3">
            <pre className="bg-destructive/10 text-destructive rounded-md p-2 text-xs whitespace-pre-wrap">
              {check.output}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

const STATUS_CLASSES: Record<HealthStatus, string> = {
  pass: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400",
  warn: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-400",
  fail: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-400",
};

function StatusBadge({ status }: { status: HealthStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ring-1 ring-inset",
        STATUS_CLASSES[status],
      )}
    >
      {status}
    </span>
  );
}

const TIER_CLASSES: Record<EnvironmentTier, string> = {
  production:
    "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-400",
  beta: "bg-blue-500/15 text-blue-700 ring-blue-500/30 dark:text-blue-400",
  stage: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-400",
  develop: "bg-red-500/15 text-red-700 ring-red-500/30 dark:text-red-400",
};

function TierBadge({ tier }: { tier: EnvironmentTier }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ring-1 ring-inset",
        TIER_CLASSES[tier],
      )}
      title={`Deployment tier: ${tier}`}
    >
      {tier}
    </span>
  );
}

function formatValue(c: HealthCheck): string {
  if (c.observedValue == null) return "—";
  return c.observedUnit
    ? `${c.observedValue} ${c.observedUnit}`
    : String(c.observedValue);
}

function formatError(err: unknown): string {
  if (err instanceof ApiError) return `${err.status} ${err.statusText}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
