import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerInitialize } from "./initialize.js";
import { registerInitialized } from "./initialized.js";

/**
 * Authentication & Initialization Features
 * Tests protocol initialization and capability negotiation
 */

export function registerAuthFeatures(server: McpServer) {
  // Register auth/initialization endpoints
  registerInitialize(server);
  registerInitialized(server);
}