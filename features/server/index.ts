import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import individual server tools
import { registerCheckServerConnection } from "./check-server-connection.js";
import { registerGetServerInfo } from "./get-server-info.js";

/**
 * Server State Management Features
 * Tests server connection and status monitoring
 */

export function registerServerFeatures(server: McpServer) {
  // Register all server management tools
  registerCheckServerConnection(server);
  registerGetServerInfo(server);
}
