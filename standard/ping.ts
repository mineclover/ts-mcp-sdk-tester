import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PingRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { EmptyResult } from "../spec/current_spec.js";

/**
 * Standard MCP Ping Endpoint
 * 
 * Implements the core MCP ping protocol endpoint:
 * - ping: Responds to ping requests to check server connectivity
 */

export function registerPingEndpoint(server: McpServer) {
  server.server.setRequestHandler(
    PingRequestSchema,
    async (): Promise<EmptyResult> => {
      // Simply return empty result to indicate the server is alive
      const result: EmptyResult = {
        _meta: {
          serverTime: new Date().toISOString(),
          status: "ok",
          uptime: process.uptime(),
        },
      };
      
      return result;
    }
  );
}