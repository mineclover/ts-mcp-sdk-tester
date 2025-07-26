import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { EmptySchema } from './schemas.js';

/**
 * Send All List Changed Tool
 * Tests sending all list changed notifications (resources, tools, prompts)
 */

export function registerSendAllListChanged(server: McpServer) {
  server.registerTool(
    "send_all_list_changed",
    {
      title: "Send All List Changed",
      description: "Test sending all list changed notifications (resources, tools, prompts)",
      inputSchema: EmptySchema.shape,
    },
    async () => {
      try {
        server.sendResourceListChanged();
        server.sendToolListChanged();
        server.sendPromptListChanged();
        
        return {
          content: [
            {
              type: "text" as const,
              text: "Successfully sent all list changed notifications:\n• Resource list changed\n• Tool list changed\n• Prompt list changed",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error sending list changed notifications: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}