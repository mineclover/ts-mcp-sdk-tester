import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Send Prompt List Changed Tool
 * Tests sending prompt list changed notification
 */

export function registerSendPromptListChanged(server: McpServer) {
  server.registerTool(
    "send_prompt_list_changed",
    {
      title: "Send Prompt List Changed",
      description: "Test sending prompt list changed notification",
      inputSchema: {},
    },
    async () => {
      try {
        server.sendPromptListChanged();
        return {
          content: [
            {
              type: "text" as const,
              text: "Successfully sent prompt list changed notification",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error sending prompt list changed notification: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}