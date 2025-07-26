import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { 
  UnsubscribeRequest, 
  EmptyResult
} from "../../spec/mcp_spec.js";

const UnsubscribeParamsSchema = z.object({
  uri: z.string(),
  _meta: z.object({}).passthrough().optional(),
});

/**
 * Registers the resources/unsubscribe endpoint handler
 * Unsubscribes from updates for a specific resource
 */
export function registerUnsubscribeResource(server: McpServer) {
  server.request(
    {
      method: "resources/unsubscribe",
      schema: {
        params: UnsubscribeParamsSchema,
      },
    },
    async (request): Promise<EmptyResult> => {
      const { uri } = request.params;
      
      // Initialize subscriptions map if it doesn't exist
      if (!(server as any)._resourceSubscriptions) {
        (server as any)._resourceSubscriptions = new Set<string>();
      }
      
      // Remove the URI from subscriptions
      (server as any)._resourceSubscriptions.delete(uri);
      
      // Return empty result indicating success
      return {};
    }
  );
}