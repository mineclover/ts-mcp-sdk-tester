import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InitializedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";

/**
 * Registers the initialized notification handler
 * Handles notifications when client has finished initialization
 */
export function registerInitialized(server: McpServer) {
  server.server.setNotificationHandler(
    InitializedNotificationSchema,
    async (notification) => {
      // Client has finished initialization
      // This is where we can perform any post-initialization setup
      console.log("Client initialization completed", {
        timestamp: new Date().toISOString(),
        meta: notification.params?._meta,
      });
      
      // Mark that the connection is fully established
      // In a real server, you might:
      // - Enable certain features
      // - Start background processes
      // - Send initial notifications
    }
  );
}