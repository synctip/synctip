/**
 * Wire types for the API's `/health` endpoints.
 *
 * Mirrors the IETF draft "Health Check Response Format for HTTP APIs":
 * https://inadarei.github.io/rfc-healthcheck/
 *
 * These types are part of the public API contract — the server
 * produces them and clients consume them. Keep them backward
 * compatible across versions.
 */

export type HealthStatus = "pass" | "fail" | "warn";

/**
 * Deployment tier the service is running in. See docs/DEPLOYMENT.md.
 * Sourced from the `APP_ENV` environment variable on the server.
 */
export type EnvironmentTier = "production" | "beta" | "stage" | "develop";

/**
 * Hosting provider the service runs on. Determines how dashboard URLs
 * are constructed for `serviceId` / `instanceId`.
 */
export type DeploymentProvider = "render" | (string & {});

/**
 * Structured deployment metadata. Clients build navigation URLs from
 * these primitives (GitHub branch/commit, provider dashboard) without
 * the server hard-coding URL shapes.
 */
export interface DeploymentInfo {
  /** GitHub-style "owner/repo" slug. */
  repository?: string;
  /** Git branch the running revision was built from. */
  branch?: string;
  /** Full commit SHA. The short form is exposed as `releaseId`. */
  commit?: string;
  /** Hosting provider (used by the client to build dashboard URLs). */
  provider?: DeploymentProvider;
  /** Provider-scoped service identifier (e.g. Render's `srv-...`). */
  serviceId?: string;
  /** Provider-scoped instance identifier. */
  instanceId?: string;
  /** Provider service type — `web_service`, `static_site`, etc. */
  serviceType?: string;
  /** Provider-reported region (e.g. `oregon`). Informational. */
  region?: string;
  /**
   * Working tree has uncommitted changes. Only meaningful for local
   * development; production builds are always built from a clean tree.
   */
  dirty?: boolean;
  /** Tracking branch (e.g. `origin/develop`). Local development only. */
  upstream?: string;
  /** Commits the local checkout has that the upstream doesn't. */
  ahead?: number;
  /** Commits the upstream has that the local checkout doesn't. */
  behind?: number;
}

export interface HealthCheck {
  componentId?: string;
  componentType?: "component" | "datastore" | "system" | (string & {});
  observedValue?: unknown;
  observedUnit?: string;
  status?: HealthStatus;
  affectedEndpoints?: string[];
  time?: string;
  output?: string;
  links?: Record<string, string>;
}

export interface HealthResponse {
  status: HealthStatus;
  version?: string;
  releaseId?: string;
  /** Deployment tier the service is running in (production/beta/stage/develop). */
  tier?: EnvironmentTier;
  /** Structured deployment metadata (branch, commit, provider service IDs). */
  deployment?: DeploymentInfo;
  notes?: string[];
  output?: string;
  checks?: Record<string, HealthCheck[]>;
  links?: Record<string, string>;
  serviceId?: string;
  description?: string;
}

export const HEALTH_CONTENT_TYPE = "application/health+json";
