/**
 * Re-export the shared API contract types from @synctip/api-client.
 * Keeping wire types in one place means the server and any client are
 * guaranteed to agree on the shape.
 */
export type {
  EnvironmentTier,
  HealthCheck,
  HealthResponse,
  HealthStatus,
} from '@synctip/api-client/types';
export { HEALTH_CONTENT_TYPE } from '@synctip/api-client/types';
