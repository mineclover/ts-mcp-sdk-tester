import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuthEndpoints } from "./auth.js";
import { registerCompletionEndpoints } from "./completion.js";
import { registerElicitationEndpoints } from "./elicitation.js";
import { registerLifecycleManagement } from "./lifecycle.js";
import { registerLoggingEndpoints } from "./logging.js";
import { registerPingEndpoint } from "./ping.js";
import { registerPromptsEndpoints } from "./prompts.js";
import { registerResourcesEndpoints } from "./resources.js";
import { registerRootsEndpoints } from "./roots.js";
import { registerSamplingEndpoints } from "./sampling.js";
import { registerToolsEndpoints } from "./tools.js";

// Re-export constants
export { APP_CONFIG, TRANSPORT_CONFIG } from "./constants.js";
// Re-export transport utilities
export { parseArguments, setupTransport, type TransportOptions } from "./transports.js";

/**
 * Standard MCP Protocol Endpoints
 *
 * This module provides implementations of all standard MCP protocol endpoints
 * as defined in the MCP specification. These endpoints use types from
 * @modelcontextprotocol/sdk/types.js and comply with the spec/current_spec.ts
 * definitions.
 */

export function registerStandardEndpoints(server: McpServer) {
  // Initialize lifecycle management first
  registerLifecycleManagement(server);
  
  // Core protocol endpoints
  registerPingEndpoint(server);
  registerAuthEndpoints(server);

  // Resource management endpoints
  registerResourcesEndpoints(server);

  // Prompt management endpoints
  registerPromptsEndpoints(server);

  // Tool management endpoints
  registerToolsEndpoints(server);

  // Advanced protocol endpoints
  registerSamplingEndpoints(server);
  registerElicitationEndpoints(server);
  registerRootsEndpoints(server);

  // Utility endpoints
  registerLoggingEndpoints(server);
  registerCompletionEndpoints(server);
}
