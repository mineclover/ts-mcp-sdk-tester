import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResourcesEndpoints } from "./resources.js";
import { registerPromptsEndpoints } from "./prompts.js";
import { registerToolsEndpoints } from "./tools.js";
import { registerPingEndpoint } from "./ping.js";
import { registerSamplingEndpoints } from "./sampling.js";
import { registerElicitationEndpoints } from "./elicitation.js";
import { registerRootsEndpoints } from "./roots.js";
import { registerAuthEndpoints } from "./auth.js";

/**
 * Standard MCP Protocol Endpoints
 * 
 * This module provides implementations of all standard MCP protocol endpoints
 * as defined in the MCP specification. These endpoints use types from
 * @modelcontextprotocol/sdk/types.js and comply with the spec/current_spec.ts
 * definitions.
 */

export function registerStandardEndpoints(server: McpServer) {
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
}