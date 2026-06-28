import type { HealthResponse } from "./types/health";

export interface ApiClientOptions {
  /**
   * Base URL of the API. Should NOT include a trailing slash.
   * Examples:
   *  - "/api" (when the host serves the API at /api, e.g. behind a proxy)
   *  - "http://localhost:3000"
   *  - "https://api.synctip.com"
   */
  baseUrl: string;

  /**
   * Override the underlying fetch implementation. Defaults to `globalThis.fetch`.
   * Useful for tests or for environments where you want retries / logging.
   */
  fetch?: typeof fetch;

  /**
   * Default headers added to every request.
   */
  headers?: HeadersInit;
}

export interface ApiClient {
  health: {
    /** Full health snapshot (system + datastore). Throws on network error. */
    check(init?: RequestInit): Promise<HealthResponse>;
    /** Liveness probe — does not touch the database. */
    live(init?: RequestInit): Promise<HealthResponse>;
    /** Readiness probe — includes downstream checks. */
    ready(init?: RequestInit): Promise<HealthResponse>;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    super(`API ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/**
 * Create a typed API client.
 *
 * The client is intentionally tiny: one function per endpoint, no caching.
 * Pair with TanStack Query (or similar) on the consumer side for caching,
 * retries, and request deduplication.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const defaultHeaders = options.headers;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json, application/health+json",
        ...defaultHeaders,
        ...init?.headers,
      },
    });

    // Health endpoints intentionally return 503 on "fail" but still
    // deliver a valid body. We treat any status that has a parseable
    // body as "success" for /health and let the caller inspect `.status`.
    const isHealthEndpoint = path.startsWith("/health");
    const contentType = res.headers.get("content-type") ?? "";
    const isJson =
      contentType.includes("application/json") ||
      contentType.includes("application/health+json");

    if (!res.ok && !(isHealthEndpoint && isJson)) {
      let body: unknown = null;
      try {
        body = isJson ? await res.json() : await res.text();
      } catch {
        // ignore parse errors
      }
      throw new ApiError(res.status, res.statusText, body);
    }

    return (await res.json()) as T;
  }

  return {
    health: {
      check: (init) => request<HealthResponse>("/health", init),
      live: (init) => request<HealthResponse>("/health/live", init),
      ready: (init) => request<HealthResponse>("/health/ready", init),
    },
  };
}
