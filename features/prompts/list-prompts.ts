import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { 
  ListPromptsRequest, 
  ListPromptsResult,
  PaginatedRequest
} from "../../spec/mcp_spec.js";

const ListPromptsParamsSchema = z.object({
  cursor: z.string().optional(),
  _meta: z.object({}).passthrough().optional(),
}).optional();

/**
 * Registers the prompts/list endpoint handler
 * Returns a list of all available prompts from the server
 */
export function registerListPrompts(server: McpServer) {
  server.request(
    {
      method: "prompts/list",
      schema: {
        params: ListPromptsParamsSchema,
      },
    },
    async (request): Promise<ListPromptsResult> => {
      const { cursor } = request.params || {};
      
      // Get all registered prompts from the server
      const allPrompts = Array.from((server as any)._prompts.values());
      
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
      const prompts = allPrompts.slice(startIndex, endIndex);
      
      const result: ListPromptsResult = {
        prompts: prompts.map(prompt => ({
          name: prompt.name,
          title: prompt.title,
          description: prompt.description,
          arguments: prompt.arguments,
          _meta: prompt._meta,
        })),
      };
      
      // Add pagination cursor if there are more results
      if (endIndex < allPrompts.length) {
        result.nextCursor = endIndex.toString();
      }
      
      return result;
    }
  );
}