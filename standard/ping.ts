import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PingRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { EmptyResult } from "../spec/current_spec.js";
import { logger } from "./logger.js";

/**
 * Standard MCP Ping Endpoint
 *
 * Implements the core MCP ping protocol endpoint:
 * - ping: Responds to ping requests to check server connectivity
 * 
 * Provides server health monitoring and connectivity testing.
 * All ping requests and responses are logged for monitoring purposes.
 */

export function registerPingEndpoint(server: McpServer) {
  logger.logMethodEntry("registerPingEndpoint", { serverType: 'McpServer' }, "ping");
  
  server.server.setRequestHandler(PingRequestSchema, async (request, extra): Promise<EmptyResult> => {
    const startTime = Date.now();
    
    // Log ping request for monitoring (debug level to avoid spam)
    await logger.logEndpointEntry("ping", extra.requestId, {
      timestamp: new Date().toISOString(),
      method: "ping",
    });

    try {
      // MCP spec requires empty response, but we can include helpful metadata
      const responseTime = Date.now() - startTime;
      const result: EmptyResult = {
        _meta: {
          serverTime: new Date().toISOString(),
          status: "ok",
          uptime: process.uptime(),
          responseTimeMs: responseTime,
          requestId: extra.requestId,
        },
      };

      // Log successful ping response
      await logger.logMethodExit("ping", {
        requestId: extra.requestId,
        responseTimeMs: responseTime,
        status: "success",
      }, "ping");

      return result;
    } catch (error) {
      // This should rarely happen for ping, but log if it does
      await logger.logServerError(
        error instanceof Error ? error : new Error(String(error)),
        "ping endpoint",
        { requestId: extra.requestId }
      );
      throw error;
    }
  });
  
  logger.info("Ping endpoint registered successfully", "ping");
}
