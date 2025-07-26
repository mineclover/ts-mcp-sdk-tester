import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ContentTestSchema } from "./schemas.js";

/**
 * Test Content Types Tool
 * Tests different content types (text, image, audio, resource) in tool responses
 */

export function registerTestContentTypes(server: McpServer) {
  server.registerTool(
    "test_content_types",
    {
      title: "Test Content Types",
      description: "Test different content types (text, image, audio, resource) in tool responses",
      inputSchema: ContentTestSchema.shape,
    },
    async ({ contentType }) => {
      try {
        const content: any[] = [];

        if (contentType === "text" || contentType === "all") {
          content.push({
            type: "text" as const,
            text: "This is a text content example with various formatting:\n• Bullet point\n• **Bold text**\n• *Italic text*\n• `Code snippet`",
          });
        }

        if (contentType === "image" || contentType === "all") {
          // Example base64 1x1 pixel PNG (red pixel)
          const base64Image =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIHWP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
          content.push({
            type: "image" as const,
            data: base64Image,
            mimeType: "image/png",
          });
        }

        if (contentType === "audio" || contentType === "all") {
          // Example minimal WAV header (placeholder)
          const base64Audio =
            "UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAaA";
          content.push({
            type: "audio" as const,
            data: base64Audio,
            mimeType: "audio/wav",
          });
        }

        if (contentType === "resource" || contentType === "all") {
          content.push({
            type: "resource" as const,
            resource: {
              uri: "test://content-types",
              text:
                'This is a resource content example with structured data:\n{\n  "name": "Sample Resource",\n  "type": "example",\n  "timestamp": "' +
                new Date().toISOString() +
                '"\n}',
              mimeType: "application/json",
            },
          });
        }

        return { content };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error testing content types: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
