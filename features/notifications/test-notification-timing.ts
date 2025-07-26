import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NotificationTimingTestSchema } from "./schemas.js";

/**
 * Test Notification Timing Tool
 * Tests sending notifications with timing intervals
 */

export function registerTestNotificationTiming(server: McpServer) {
  server.registerTool(
    "test_notification_timing",
    {
      title: "Test Notification Timing",
      description: "Test sending notifications with timing intervals",
      inputSchema: NotificationTimingTestSchema.shape,
    },
    async ({ count, interval, type }) => {
      try {
        const results: string[] = [];

        for (let i = 0; i < count; i++) {
          if (i > 0) {
            // Wait for the specified interval
            await new Promise((resolve) => setTimeout(resolve, interval));
          }

          const timestamp = new Date().toISOString();

          switch (type) {
            case "resources":
              server.sendResourceListChanged();
              results.push(`${timestamp}: Resource list changed notification #${i + 1}`);
              break;
            case "tools":
              server.sendToolListChanged();
              results.push(`${timestamp}: Tool list changed notification #${i + 1}`);
              break;
            case "prompts":
              server.sendPromptListChanged();
              results.push(`${timestamp}: Prompt list changed notification #${i + 1}`);
              break;
            case "all":
              server.sendResourceListChanged();
              server.sendToolListChanged();
              server.sendPromptListChanged();
              results.push(`${timestamp}: All list changed notifications #${i + 1}`);
              break;
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully sent ${count} ${type} notifications with ${interval}ms intervals:\n${results.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error testing notification timing: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
