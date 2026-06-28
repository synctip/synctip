import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type {
  HealthCheck,
  HealthResponse,
  HealthStatus,
} from "@synctip/api-client";
import { ApiError } from "@synctip/api-client";
import { api } from "../lib/api";

export const Route = createFileRoute("/health")({
  component: HealthPage,
});

function HealthPage() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => api.health.check({ signal }),
    refetchInterval: 10_000,
  });

  return (
    <main
      style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}
      aria-busy={query.isFetching}
    >
      <h1>API health</h1>

      <div aria-live="polite" aria-atomic="true">
        {query.isPending && <p>Loading…</p>}

        {query.isError && (
          <p style={{ color: "crimson" }} role="alert">
            Failed to reach API: {formatError(query.error)}
          </p>
        )}

        {query.data && <HealthReport data={query.data} />}
      </div>

      <p style={{ marginTop: "1.5rem", opacity: 0.6, fontSize: "0.85rem" }}>
        Auto-refreshes every 10s
        {query.isFetching && query.data ? " · refreshing…" : ""}
      </p>
    </main>
  );
}

function HealthReport({ data }: { data: HealthResponse }) {
  return (
    <section>
      <header style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <StatusBadge status={data.status} />
        <strong>{data.serviceId ?? "service"}</strong>
        {data.version && <span style={{ opacity: 0.6 }}>v{data.version}</span>}
        {data.releaseId && (
          <span style={{ opacity: 0.6 }}>build {data.releaseId}</span>
        )}
      </header>

      {data.description && <p style={{ opacity: 0.7 }}>{data.description}</p>}

      {data.notes && data.notes.length > 0 && (
        <ul
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            padding: 0,
            listStyle: "none",
            margin: "0.5rem 0",
          }}
        >
          {data.notes.map((n) => (
            <li
              key={n}
              style={{
                fontSize: "0.75rem",
                padding: "0.1rem 0.5rem",
                borderRadius: "4px",
                background: "rgba(125,125,125,0.15)",
              }}
            >
              {n}
            </li>
          ))}
        </ul>
      )}

      {data.output && (
        <pre
          style={{
            background: "rgba(163,0,26,0.08)",
            padding: "0.75rem",
            borderRadius: "6px",
            whiteSpace: "pre-wrap",
          }}
        >
          {data.output}
        </pre>
      )}

      <h2 style={{ marginTop: "1.5rem" }}>Components</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th>Component</th>
            <th>Status</th>
            <th>Value</th>
            <th>Observed</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.checks ?? {}).flatMap(([name, checks]) =>
            checks.map((c, i) => (
              <CheckRow key={`${name}-${i}`} name={name} check={c} />
            )),
          )}
        </tbody>
      </table>
    </section>
  );
}

function CheckRow({ name, check }: { name: string; check: HealthCheck }) {
  const status = check.status ?? "pass";
  return (
    <>
      <tr style={{ borderTop: "1px solid rgba(125,125,125,0.25)" }}>
        <td style={{ padding: "0.5rem 0.25rem" }}>
          <code>{name}</code>
          {check.componentId && (
            <small style={{ opacity: 0.6 }}> · {check.componentId}</small>
          )}
          {check.componentType && (
            <small style={{ opacity: 0.5 }}> ({check.componentType})</small>
          )}
        </td>
        <td style={{ padding: "0.5rem 0.25rem" }}>
          <StatusBadge status={status} />
        </td>
        <td style={{ padding: "0.5rem 0.25rem" }}>{formatValue(check)}</td>
        <td style={{ padding: "0.5rem 0.25rem", opacity: 0.7 }}>
          {check.time ? new Date(check.time).toLocaleTimeString() : "—"}
        </td>
      </tr>
      {check.output && status !== "pass" && (
        <tr>
          <td colSpan={4} style={{ padding: "0 0.25rem 0.5rem" }}>
            <pre
              style={{
                margin: 0,
                background: "rgba(163,0,26,0.08)",
                padding: "0.5rem",
                borderRadius: "4px",
                fontSize: "0.8rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {check.output}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const color =
    status === "pass" ? "#0a7d2c" : status === "warn" ? "#a36a00" : "#a3001a";
  const bg =
    status === "pass" ? "#e2f5e8" : status === "warn" ? "#fdefcd" : "#fbe1e3";
  return (
    <span
      style={{
        background: bg,
        color,
        padding: "0.15rem 0.55rem",
        borderRadius: "999px",
        fontSize: "0.8rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {status}
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
