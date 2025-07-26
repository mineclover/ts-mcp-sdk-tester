import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "zod";
import type { 
  ListResourcesResult
} from "../../spec/mcp_spec.js";

const ListResourcesParamsSchema = z.object({
  cursor: z.string().optional(),
  _meta: z.object({}).passthrough().optional(),
}).optional();

/**
 * Registers the resources/list endpoint handler
 * Returns a list of all available resources from the server
 */
export function registerListResources(server: Server) {
  server.setRequestHandler(
    {
      method: "resources/list",
      schema: {
        params: ListResourcesParamsSchema,
      },
    },
    async (request): Promise<ListResourcesResult> => {
      const { cursor } = request.params || {};
      
      // Get all registered resources from the server
      const allResources: any[] = [];
      
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
        resources: resources.map(resource => ({
          name: resource.name,
          title: resource.title,
          uri: resource.uri,
          description: resource.description,
          mimeType: resource.mimeType,
          annotations: resource.annotations,
          size: resource.size,
          _meta: resource._meta,
        })),
      };
      
      // Add pagination cursor if there are more results
      if (endIndex < allResources.length) {
        result.nextCursor = endIndex.toString();
      }
      
      return result;
    }
  );
}