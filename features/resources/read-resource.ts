import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  ReadResourceResult,
  TextResourceContents,
  BlobResourceContents
} from "../../spec/current_spec.js";

/**
 * Registers the resources/read endpoint handler
 * Reads the content of a specific resource by URI
 */
export function registerReadResource(server: McpServer) {
  server.server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request): Promise<ReadResourceResult> => {
      const { uri } = request.params;
      
      // Sample resource data based on URI
      let contents: (TextResourceContents | BlobResourceContents)[];
      
      if (uri === "test://resource1") {
        contents = [{
          uri,
          text: "This is the content of test resource 1.\nIt contains sample text data.",
          mimeType: "text/plain",
          _meta: { 
            readTime: new Date().toISOString(),
            size: 54,
          },
        }];
      } else if (uri === "test://resource2") {
        contents = [{
          uri,
          text: JSON.stringify({
            message: "This is test resource 2",
            data: { 
              value: 42, 
              active: true,
              timestamp: new Date().toISOString(),
            }
          }, null, 2),
          mimeType: "application/json",
          _meta: { 
            readTime: new Date().toISOString(),
            size: 120,
          },
        }];
      } else if (uri.startsWith("file:///")) {
        // Sample file resource
        const filename = uri.split("/").pop() || "unknown";
        contents = [{
          uri,
          text: `Content of file: ${filename}\nThis is simulated file content.`,
          mimeType: "text/plain",
          _meta: { 
            readTime: new Date().toISOString(),
            filename,
          },
        }];
      } else if (uri.startsWith("api:///")) {
        // Sample API resource
        contents = [{
          uri,
          blob: Buffer.from("Sample binary data from API").toString("base64"),
          mimeType: "application/octet-stream",
          _meta: { 
            readTime: new Date().toISOString(),
            apiEndpoint: uri,
          },
        }];
      } else {
        throw new Error(`Resource not found: ${uri}`);
      }
      
      const result: ReadResourceResult = {
        contents,
        _meta: {
          readTime: new Date().toISOString(),
          requestedUri: uri,
        },
      };
      
      return result;
    }
  );
}