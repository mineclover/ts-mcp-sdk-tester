import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Test Content Metadata Tool
 * Tests content responses with custom metadata
 */

export function registerTestContentMetadata(server: McpServer) {
  server.registerTool(
    "test_content_metadata",
    {
      title: "Test Content Metadata",
      description: "Test content responses with custom metadata",
      inputSchema: {
        contentType: z.enum(["text", "resource"]).describe("Type of content to test"),
        includeCustomMeta: z.boolean().optional().describe("Whether to include custom metadata"),
      },
    },
    async ({ contentType, includeCustomMeta }) => {
      try {
        const baseContent = {
          type: contentType ,
        };

        let content: any;

        if (contentType === "text") {
          content = {
            ...baseContent,
            text: "This is text content with metadata support.",
            ...(includeCustomMeta && {
              _meta: {
                author: "MCP SDK Tester",
                category: "test",
                tags: ["content", "metadata", "test"],
                timestamp: new Date().toISOString(),
              }
            })
          };
        } else {
          content = {
            ...baseContent,
            resource: {
              uri: "test://metadata-example",
              text: JSON.stringify({
                message: "Resource with metadata",
                data: { key: "value", number: 42 }
              }, null, 2),
              mimeType: "application/json",
              ...(includeCustomMeta && {
                _meta: {
                  resourceType: "example",
                  version: "1.0",
                  readonly: false,
                }
              })
            }
          };
        }

        return {
          content: [content],
          ...(includeCustomMeta && {
            _meta: {
              responseType: "content-metadata-test",
              generatedAt: new Date().toISOString(),
              contentCount: 1,
            }
          })
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error testing content metadata: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}