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
  notes?: string[];
  output?: string;
  checks?: Record<string, HealthCheck[]>;
  links?: Record<string, string>;
  serviceId?: string;
  description?: string;
}

export const HEALTH_CONTENT_TYPE = "application/health+json";
