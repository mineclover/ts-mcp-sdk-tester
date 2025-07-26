import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PingRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { EmptyResult } from "../spec/current_spec.js";
import { logger } from "./logger.js";

/**
 * Standard MCP Ping Endpoint
 *
 * Implements the core MCP ping protocol endpoint:
 * - ping: Responds to ping requests to check server connectivity
 */

export function registerPingEndpoint(server: McpServer) {
  server.server.setRequestHandler(PingRequestSchema, async (request, extra): Promise<EmptyResult> => {
    const startTime = Date.now();
    
    // Log ping request for monitoring (debug level to avoid spam)
    await logger.debug(
      `Ping received from client [${extra.requestId}]`,
      "ping"
    );

    // MCP spec requires empty response, but we can include helpful metadata
    const result: EmptyResult = {
      _meta: {
        serverTime: new Date().toISOString(),
        status: "ok",
        uptime: process.uptime(),
        responseTimeMs: Date.now() - startTime,
        requestId: extra.requestId,
      },
    };

    // Log successful ping response (debug level)
    await logger.debug(
      `Ping response sent [${extra.requestId}] (${Date.now() - startTime}ms)`,
      "ping"
    );

    return result;
  });
}
