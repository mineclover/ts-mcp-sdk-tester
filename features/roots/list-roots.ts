import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  ListRootsResult
} from "../../spec/current_spec.js";

/**
 * Registers the roots/list endpoint handler
 * Requests a list of root URIs from the client
 */
export function registerListRoots(server: McpServer) {
  server.server.setRequestHandler(
    ListRootsRequestSchema,
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