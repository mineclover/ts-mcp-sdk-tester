import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UnsubscribeRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  EmptyResult
} from "../../spec/current_spec.js";

// Import the same subscription storage used in subscribe
// In a real implementation, this would be a shared service
const resourceSubscriptions = new Set<string>();

/**
 * Registers the resources/unsubscribe endpoint handler
 * Unsubscribes from updates for a specific resource
 */
export function registerUnsubscribeResource(server: McpServer) {
  server.server.setRequestHandler(
    UnsubscribeRequestSchema,
    async (request): Promise<EmptyResult> => {
      const { uri } = request.params;
      
      // Validate URI format
      if (!uri || typeof uri !== 'string') {
        throw new Error('Invalid URI provided for unsubscription');
      }
      
      // Check if actually subscribed
      const wasSubscribed = resourceSubscriptions.has(uri);
      
      // Remove the URI from subscriptions
      resourceSubscriptions.delete(uri);
      
      console.log(`Unsubscribed from resource: ${uri} (was subscribed: ${wasSubscribed})`);
      
      // Return empty result indicating success
      const result: EmptyResult = {
        _meta: {
          unsubscriptionTime: new Date().toISOString(),
          unsubscribedUri: uri,
          wasSubscribed,
          remainingSubscriptions: resourceSubscriptions.size,
        },
      };
      
      return result;
    }
  );
}