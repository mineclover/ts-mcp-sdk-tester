import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Test Large Content Tool
 * Tests handling of large content responses
 */

export function registerTestLargeContent(server: McpServer) {
  server.registerTool(
    "test_large_content",
    {
      title: "Test Large Content",
      description: "Test handling of large content responses",
      inputSchema: {
        size: z.enum(["small", "medium", "large"]).describe("Size of content to generate"),
        contentType: z.enum(["text", "json", "base64"]).describe("Type of large content"),
      },
    },
    async ({ size, contentType }) => {
      try {
        const sizes = {
          small: 100,
          medium: 1000,
          large: 10000
        };

        const targetSize = sizes[size];
        let generatedContent = "";

        switch (contentType) {
          case "text":
            generatedContent = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(Math.ceil(targetSize / 60));
            break;
          case "json":
            const jsonObj = {
              data: Array.from({ length: Math.ceil(targetSize / 20) }, (_, i) => ({
                id: i,
                name: `Item ${i}`,
                value: Math.random() * 100,
                timestamp: new Date().toISOString()
              }))
            };
            generatedContent = JSON.stringify(jsonObj, null, 2);
            break;
          case "base64":
            generatedContent = Buffer.from("A".repeat(targetSize)).toString('base64');
            break;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Generated ${size} ${contentType} content (${generatedContent.length} characters):`,
            },
            {
              type: contentType === "base64" ? "text" as const : "text" as const,
              text: generatedContent.substring(0, 1000) + (generatedContent.length > 1000 ? "..." : ""),
            },
            {
              type: "text" as const,
              text: `Content size: ${generatedContent.length} characters`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error testing large content: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}