import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import individual server tools
import { registerCheckServerConnection } from "./check-server-connection.js";
import { registerGetServerInfo } from "./get-server-info.js";
import { registerCloseServerConnection } from "./close-server-connection.js";
import { registerGetTransportInfo } from "./get-transport-info.js";
import { registerGetRegistryDetails } from "./get-registry-details.js";
import { registerClearAllRegistrations } from "./clear-all-registrations.js";
import { registerValidateRegistrations } from "./validate-registrations.js";
import { registerGetPerformanceMetrics } from "./get-performance-metrics.js";
import { registerHealthCheck } from "./health-check.js";
import { registerTestErrorHandling } from "./test-error-handling.js";
import { registerTestAllEndpoints } from "./test-all-endpoints.js";

/**
 * Server State Management Features
 * Tests server connection, status monitoring, and advanced server capabilities
 */

export function registerServerFeatures(server: McpServer) {
  // Register basic server management tools
  registerCheckServerConnection(server);
  registerGetServerInfo(server);
  
  // Register server lifecycle tools
  registerCloseServerConnection(server);
  registerGetTransportInfo(server);
  
  // Register registry management tools
  registerGetRegistryDetails(server);
  registerClearAllRegistrations(server);
  registerValidateRegistrations(server);
  
  // Register monitoring and diagnostics tools
  registerGetPerformanceMetrics(server);
  registerHealthCheck(server);
  
  // Register testing utilities
  registerTestErrorHandling(server);
  registerTestAllEndpoints(server);
}
