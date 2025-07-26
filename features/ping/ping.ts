import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PingRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { EmptyResult } from "../../spec/current_spec.js";

/**
 * Registers the ping endpoint handler
 * Responds to ping requests to check server connectivity
 */
export function registerPing(server: McpServer) {
  server.server.setRequestHandler(
    PingRequestSchema,
    async (request): Promise<EmptyResult> => {
      // Simply return empty result to indicate the server is alive
      const result: EmptyResult = {
        _meta: {
          serverTime: new Date().toISOString(),
        },
      };
      
      return result;
    }
  );
}