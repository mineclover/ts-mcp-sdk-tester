import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPing } from "./ping.js";

/**
 * Ping Features
 * Tests server connectivity and responsiveness
 */

export function registerPingFeatures(server: McpServer) {
  // Register ping endpoint
  registerPing(server);
}