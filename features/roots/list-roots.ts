import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { 
  ListRootsRequest, 
  ListRootsResult
} from "../../spec/mcp_spec.js";

const ListRootsParamsSchema = z.object({
  _meta: z.object({}).passthrough().optional(),
}).optional();

/**
 * Registers the roots/list endpoint handler
 * Requests a list of root URIs from the client
 */
export function registerListRoots(server: McpServer) {
  server.request(
    {
      method: "roots/list",
      schema: {
        params: ListRootsParamsSchema,
      },
    },
    async (request): Promise<ListRootsResult> => {
      // This is a server-to-client request, so in a real implementation,
      // the server would send this request to the client to get available roots.
      // For testing purposes, we'll simulate a response.
      
      // Simulate typical development environment roots
      const simulatedRoots = [
        {
          uri: "file:///Users/developer/projects",
          name: "Projects Directory",
          _meta: {
            description: "Main projects directory",
            simulatedRoot: true,
          },
        },
        {
          uri: "file:///Users/developer/documents",
          name: "Documents",
          _meta: {
            description: "User documents directory", 
            simulatedRoot: true,
          },
        },
        {
          uri: "file:///tmp",
          name: "Temporary Files",
          _meta: {
            description: "System temporary directory",
            simulatedRoot: true,
          },
        },
      ];
      
      const result: ListRootsResult = {
        roots: simulatedRoots,
        _meta: {
          simulatedResponse: true,
          requestId: Date.now().toString(),
          totalRoots: simulatedRoots.length,
        },
      };
      
      return result;
    }
  );
}