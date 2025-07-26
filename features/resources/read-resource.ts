import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { 
  ReadResourceRequest, 
  ReadResourceResult,
  TextResourceContents,
  BlobResourceContents
} from "../../spec/mcp_spec.js";

const ReadResourceParamsSchema = z.object({
  uri: z.string(),
  _meta: z.object({}).passthrough().optional(),
});

/**
 * Registers the resources/read endpoint handler
 * Reads the content of a specific resource by URI
 */
export function registerReadResource(server: McpServer) {
  server.request(
    {
      method: "resources/read",
      schema: {
        params: ReadResourceParamsSchema,
      },
    },
    async (request): Promise<ReadResourceResult> => {
      const { uri } = request.params;
      
      // Find the resource handler in the server
      const resourceHandler = (server as any)._resources.get(uri);
      
      if (!resourceHandler) {
        throw new Error(`Resource not found: ${uri}`);
      }
      
      try {
        // Call the resource handler to get the content
        const resourceData = await resourceHandler.handler();
        
        // Handle different content types
        const contents: (TextResourceContents | BlobResourceContents)[] = [];
        
        if (Array.isArray(resourceData)) {
          // Multiple resources returned
          for (const item of resourceData) {
            if (typeof item === 'string') {
              contents.push({
                uri,
                text: item,
                mimeType: 'text/plain',
              });
            } else if (item && typeof item === 'object') {
              if ('text' in item) {
                contents.push({
                  uri: item.uri || uri,
                  text: item.text,
                  mimeType: item.mimeType || 'text/plain',
                  _meta: item._meta,
                });
              } else if ('blob' in item) {
                contents.push({
                  uri: item.uri || uri,
                  blob: item.blob,
                  mimeType: item.mimeType || 'application/octet-stream',
                  _meta: item._meta,
                });
              }
            }
          }
        } else if (typeof resourceData === 'string') {
          // Single text resource
          contents.push({
            uri,
            text: resourceData,
            mimeType: 'text/plain',
          });
        } else if (resourceData && typeof resourceData === 'object') {
          // Single structured resource
          if ('text' in resourceData) {
            contents.push({
              uri: resourceData.uri || uri,
              text: resourceData.text,
              mimeType: resourceData.mimeType || 'text/plain',
              _meta: resourceData._meta,
            });
          } else if ('blob' in resourceData) {
            contents.push({
              uri: resourceData.uri || uri,
              blob: resourceData.blob,
              mimeType: resourceData.mimeType || 'application/octet-stream',
              _meta: resourceData._meta,
            });
          }
        }
        
        if (contents.length === 0) {
          throw new Error(`Unable to read resource content for: ${uri}`);
        }
        
        return { contents };
        
      } catch (error) {
        throw new Error(`Failed to read resource ${uri}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );
}