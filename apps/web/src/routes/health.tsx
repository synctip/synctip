import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type {
  HealthCheck,
  HealthResponse,
  HealthStatus,
} from "@synctip/api-client";
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
    <main style={{ padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>API health</h1>

      {query.isPending && <p>Loading…</p>}
      {query.isError && (
        <p style={{ color: "crimson" }}>
          Failed to reach API: {String(query.error)}
        </p>
      )}

      {query.data && <HealthReport data={query.data} />}

      <p style={{ marginTop: "1.5rem", opacity: 0.6, fontSize: "0.85rem" }}>
        Auto-refreshes every 10s.
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
        <span style={{ opacity: 0.6 }}>v{data.version}</span>
        {data.releaseId && (
          <span style={{ opacity: 0.6 }}>build {data.releaseId}</span>
        )}
      </header>

      {data.description && <p style={{ opacity: 0.7 }}>{data.description}</p>}

      <h2 style={{ marginTop: "1.5rem" }}>Components</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th align="left">Component</th>
            <th align="left">Status</th>
            <th align="left">Value</th>
            <th align="left">Observed</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.checks ?? {}).flatMap(([name, checks]) =>
            checks.map((c, i) => (
              <tr key={`${name}-${i}`} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "0.5rem 0.25rem" }}>
                  <code>{name}</code>
                  {c.componentId && (
                    <small style={{ opacity: 0.6 }}> · {c.componentId}</small>
                  )}
                </td>
                <td style={{ padding: "0.5rem 0.25rem" }}>
                  <StatusBadge status={c.status ?? "pass"} />
                </td>
                <td style={{ padding: "0.5rem 0.25rem" }}>{formatValue(c)}</td>
                <td style={{ padding: "0.5rem 0.25rem", opacity: 0.7 }}>
                  {c.time ? new Date(c.time).toLocaleTimeString() : "—"}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </section>
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
