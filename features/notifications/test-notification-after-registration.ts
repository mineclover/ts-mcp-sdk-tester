import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Test Notification After Registration Tool
 * Registers a new item and immediately sends appropriate notification
 */

export function registerTestNotificationAfterRegistration(server: McpServer) {
  server.registerTool(
    "test_notification_after_registration",
    {
      title: "Test Notification After Registration",
      description: "Register a new item and immediately send appropriate notification",
      inputSchema: {
        itemType: z.enum(["resource", "tool", "prompt"]).describe("Type of item to register"),
        itemName: z.string().describe("Name of the item to register"),
      },
    },
    async ({ itemType, itemName }) => {
      try {
        const timestamp = new Date().toISOString();
        
        switch (itemType) {
          case "resource":
            // Register a test resource
            server.registerResource(itemName, `test://${itemName}`, {
              title: itemName,
              description: `Test resource created at ${timestamp}`,
            }, async (uri: any) => ({
              contents: [
                {
                  uri: uri.href,
                  text: `Resource ${itemName} created at ${timestamp}`,
                  mimeType: "text/plain",
                },
              ],
            }));
            
            // Send notification
            server.sendResourceListChanged();
            break;
            
          case "tool":
            // Register a test tool
            server.registerTool(itemName, {
              title: itemName,
              description: `Test tool created at ${timestamp}`,
              inputSchema: {},
            }, async () => ({
              content: [
                {
                  type: "text" as const,
                  text: `Tool ${itemName} executed at ${new Date().toISOString()}`,
                },
              ],
            }));
            
            // Send notification
            server.sendToolListChanged();
            break;
            
          case "prompt":
            // Register a test prompt
            server.registerPrompt(itemName, {
              title: itemName,
              description: `Test prompt created at ${timestamp}`,
              argsSchema: {},
            }, () => ({
              messages: [
                {
                  role: "user" as const,
                  content: {
                    type: "text" as const,
                    text: `Prompt ${itemName} generated at ${new Date().toISOString()}`,
                  },
                },
              ],
            }));
            
            // Send notification
            server.sendPromptListChanged();
            break;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered ${itemType} '${itemName}' and sent ${itemType} list changed notification at ${timestamp}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error testing notification after registration: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}