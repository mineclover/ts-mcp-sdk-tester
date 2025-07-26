import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSetLevel } from "./set-level.js";

/**
 * Logging Features
 * Handles server logging level configuration and message notifications
 */

export function registerLoggingFeatures(server: McpServer) {
  // Register logging/setLevel method
  registerSetLevel(server);
}

// Re-export utilities for use by other features
export { getCurrentLoggingState, sendLogMessage } from "./set-level.js";