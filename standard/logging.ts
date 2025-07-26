import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { EmptyResult } from "../spec/current_spec.js";
import { logger } from "./logger.js";

/**
 * Standard MCP Logging Endpoints
 *
 * Implements the core MCP logging protocol endpoints:
 * - logging/setLevel: Set the logging level for server messages
 */

export function registerLoggingEndpoints(server: McpServer) {
  // Initialize logger with MCP server for client notifications
  logger.initialize(server);

  registerSetLevel(server);
}

/**
 * logging/setLevel endpoint
 * Set the logging level that the client wants to receive from the server
 */
function registerSetLevel(server: McpServer) {
  server.server.setRequestHandler(SetLevelRequestSchema, async (request): Promise<EmptyResult> => {
    const { level } = request.params;

    // Actually configure the logging level
    logger.setLevel(level);

    const result: EmptyResult = {
      _meta: {
        loggingLevel: level,
        levelSetAt: new Date().toISOString(),
        message: `Logging level set to: ${level}`,
        previousLevel: logger.getLevel(),
        severityLevels: [
          "debug",
          "info",
          "notice",
          "warning",
          "error",
          "critical",
          "alert",
          "emergency",
        ],
      },
    };

    return result;
  });
}
