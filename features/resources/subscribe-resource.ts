import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SubscribeRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  EmptyResult
} from "../../spec/current_spec.js";

// Global subscription storage for demo purposes
const resourceSubscriptions = new Set<string>();

/**
 * Registers the resources/subscribe endpoint handler
 * Subscribes to updates for a specific resource
 */
export function registerSubscribeResource(server: McpServer) {
  server.server.setRequestHandler(
    SubscribeRequestSchema,
    async (request): Promise<EmptyResult> => {
      const { uri } = request.params;
      
      // Validate URI format
      if (!uri || typeof uri !== 'string') {
        throw new Error('Invalid URI provided for subscription');
      }
      
      // For demo purposes, accept any valid URI
      // In a real implementation, you'd check if the resource exists
      
      // Add the URI to subscriptions
      resourceSubscriptions.add(uri);
      
      console.log(`Subscribed to resource: ${uri}`);
      
      // Return empty result indicating success
      const result: EmptyResult = {
        _meta: {
          subscriptionTime: new Date().toISOString(),
          subscribedUri: uri,
          totalSubscriptions: resourceSubscriptions.size,
        },
      };
      
      return result;
    }
  );
}