import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  EmptyResult,
  LoggingLevel
} from "../spec/current_spec.js";

/**
 * Standard MCP Logging Endpoints
 * 
 * Implements the core MCP logging protocol endpoints:
 * - logging/setLevel: Set the logging level for server messages
 */

export function registerLoggingEndpoints(server: McpServer) {
  registerSetLevel(server);
}

/**
 * logging/setLevel endpoint
 * Set the logging level that the client wants to receive from the server
 */
function registerSetLevel(server: McpServer) {
  server.server.setRequestHandler(
    SetLevelRequestSchema,
    async (request): Promise<EmptyResult> => {
      const { level } = request.params;
      
      // In a real implementation, this would configure the server's logging level
      // For testing purposes, we'll just acknowledge the level setting
      
      const result: EmptyResult = {
        _meta: {
          loggingLevel: level,
          levelSetAt: new Date().toISOString(),
          message: `Logging level set to: ${level}`,
          severityLevels: [
            "debug", "info", "notice", "warning", 
            "error", "critical", "alert", "emergency"
          ],
        },
      };
      
      return result;
    }
  );
}