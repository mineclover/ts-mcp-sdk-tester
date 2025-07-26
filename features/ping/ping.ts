import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { 
  PingRequest, 
  EmptyResult
} from "../../spec/mcp_spec.js";

const PingParamsSchema = z.object({
  _meta: z.object({}).passthrough().optional(),
}).optional();

/**
 * Registers the ping endpoint handler
 * Responds to ping requests to check server connectivity
 */
export function registerPing(server: McpServer) {
  server.request(
    {
      method: "ping",
      schema: {
        params: PingParamsSchema,
      },
    },
    async (request): Promise<EmptyResult> => {
      // Simply return empty result to indicate the server is alive
      return {};
    }
  );
}