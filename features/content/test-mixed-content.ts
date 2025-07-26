import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Test Mixed Content Tool
 * Tests a response with multiple different content types mixed together
 */

export function registerTestMixedContent(server: McpServer) {
  server.registerTool(
    "test_mixed_content",
    {
      title: "Test Mixed Content",
      description: "Test a response with multiple different content types mixed together",
      inputSchema: {
        includeMetadata: z
          .boolean()
          .optional()
          .describe("Whether to include metadata in the response"),
      },
    },
    async ({ includeMetadata }) => {
      try {
        const content: any[] = [
          {
            type: "text" as const,
            text: "# Mixed Content Response\n\nThis response contains multiple content types:",
          },
          {
            type: "resource" as const,
            resource: {
              uri: "data://example.json",
              text: JSON.stringify(
                {
                  message: "Hello from resource",
                  timestamp: new Date().toISOString(),
                  metadata: includeMetadata
                    ? {
                        version: "1.0.0",
                        contentTypes: ["text", "resource", "image"],
                        generated: true,
                      }
                    : undefined,
                },
                null,
                2
              ),
              mimeType: "application/json",
            },
          },
          {
            type: "text" as const,
            text: "Here's a small example image:",
          },
          {
            type: "image" as const,
            data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHyfmPjEwAAAABJRU5ErkJggg==",
            mimeType: "image/png",
          },
        ];

        if (includeMetadata) {
          content.push({
            type: "text" as const,
            text: "Response generated with metadata enabled.",
          });
        }

        return { content };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error testing mixed content: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
