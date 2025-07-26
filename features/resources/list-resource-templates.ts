import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListResourceTemplatesRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type {
  ListResourceTemplatesResult,
  ResourceTemplate,
} from "../../spec/current_spec.js";

/**
 * Registers the resources/templates/list method handler
 * Lists all available resource templates that the server can provide
 */
export function registerListResourceTemplates(server: McpServer): void {
  server.server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async (request): Promise<ListResourceTemplatesResult> => {
      const { cursor } = request.params || {};
      
      // Sample resource templates for demonstration
      const allTemplates: ResourceTemplate[] = [
        {
          name: "file-template",
          title: "File Template",
          uriTemplate: "file:///{path}",
          description: "Template for accessing files by path",
          mimeType: "text/plain",
          _meta: { created: new Date().toISOString() },
        },
        {
          name: "api-template",
          title: "API Template", 
          uriTemplate: "api:///{endpoint}?{params}",
          description: "Template for API endpoint access",
          mimeType: "application/json",
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
      const resourceTemplates = allTemplates.slice(startIndex, endIndex);

      const result: ListResourceTemplatesResult = {
        resourceTemplates,
        _meta: {
          totalCount: allTemplates.length,
          pageSize,
          startIndex,
        },
      };
      
      // Add pagination cursor if there are more results
      if (endIndex < allTemplates.length) {
        result.nextCursor = endIndex.toString();
      }

      return result;
    }
  );
}