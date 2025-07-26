import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { 
  SubscribeRequest, 
  EmptyResult
} from "../../spec/mcp_spec.js";

const SubscribeParamsSchema = z.object({
  uri: z.string(),
  _meta: z.object({}).passthrough().optional(),
});

/**
 * Registers the resources/subscribe endpoint handler
 * Subscribes to updates for a specific resource
 */
export function registerSubscribeResource(server: McpServer) {
  server.request(
    {
      method: "resources/subscribe",
      schema: {
        params: SubscribeParamsSchema,
      },
    },
    async (request): Promise<EmptyResult> => {
      const { uri } = request.params;
      
      // Check if the resource exists
      const resourceHandler = (server as any)._resources.get(uri);
      
      if (!resourceHandler) {
        throw new Error(`Resource not found: ${uri}`);
      }
      
      // Initialize subscriptions map if it doesn't exist
      if (!(server as any)._resourceSubscriptions) {
        (server as any)._resourceSubscriptions = new Set<string>();
      }
      
      // Add the URI to subscriptions
      (server as any)._resourceSubscriptions.add(uri);
      
      // Return empty result indicating success
      return {};
    }
  );
}