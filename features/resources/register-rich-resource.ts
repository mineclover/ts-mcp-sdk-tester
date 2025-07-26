import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registeredResources } from "./register-simple-resource.js";

/**
 * Register Rich Resource Tool
 * Registers a resource with rich content (JSON, binary data, etc.)
 */

export function registerRegisterRichResource(server: McpServer) {
  server.registerTool(
    "register_rich_resource",
    {
      title: "Register Rich Resource",
      description: "Register a resource with rich content (JSON, binary data, etc.)",
      inputSchema: {
        uri: z.string().describe("The URI for the resource"),
        name: z.string().describe("Name of the resource"),
        contentType: z.enum(["json", "xml", "binary", "markdown"]).describe("Type of content"),
        content: z.string().describe("Content data"),
      },
    },
    async ({ uri, name, contentType, content }) => {
      try {
        const mimeTypes = {
          json: "application/json",
          xml: "application/xml",
          binary: "application/octet-stream",
          markdown: "text/markdown",
        };

        server.registerResource(
          name,
          uri,
          {
            title: name,
            description: `Rich resource with ${contentType} content`,
          },
          async (uri: any) => ({
            contents: [
              {
                uri: uri.href,
                text: content,
                mimeType: mimeTypes[contentType],
              },
            ],
          })
        );

        registeredResources.set(uri, { name, contentType, content, isRich: true });

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully registered rich resource: ${uri} (${contentType})`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error registering rich resource: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
