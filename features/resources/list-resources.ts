import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListResourcesRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { 
  ListResourcesResult,
  Resource
} from "../../spec/current_spec.js";

/**
 * Registers the resources/list endpoint handler
 * Returns a list of all available resources from the server
 */
export function registerListResources(server: McpServer) {
  server.server.setRequestHandler(
    ListResourcesRequestSchema,
    async (request): Promise<ListResourcesResult> => {
      const { cursor } = request.params || {};
      
      // Sample resources for demonstration
      const allResources: Resource[] = [
        {
          name: "test-resource-1",
          title: "Test Resource 1",
          uri: "test://resource1",
          description: "A sample test resource for demonstration",
          mimeType: "text/plain",
          size: 100,
          _meta: { created: new Date().toISOString() },
        },
        {
          name: "test-resource-2", 
          title: "Test Resource 2",
          uri: "test://resource2",
          description: "Another sample test resource",
          mimeType: "application/json",
          size: 200,
          _meta: { created: new Date().toISOString() },
        },
      ];
      
      // Simple pagination implementation
      const pageSize = 10;
      let startIndex = 0;
      
      if (cursor) {
        try {
          startIndex = parseInt(cursor, 10);
        } catch (e) {
          startIndex = 0;
        }
      }
      
      const endIndex = startIndex + pageSize;
      const resources = allResources.slice(startIndex, endIndex);
      
      const result: ListResourcesResult = {
        resources,
        _meta: {
          totalCount: allResources.length,
          pageSize,
          startIndex,
        },
      };
      
      // Add pagination cursor if there are more results
      if (endIndex < allResources.length) {
        result.nextCursor = endIndex.toString();
      }
      
      return result;
    }
  );
}