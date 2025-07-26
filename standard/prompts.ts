import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  ContentBlock,
  GetPromptResult,
  ListPromptsResult,
  Prompt,
  PromptMessage,
} from "../spec/current_spec.js";
import { DEMO_PROMPTS, getDemoPromptMessages } from "../demo/index.js";

/**
 * Standard MCP Prompts Endpoints
 *
 * Implements the core MCP prompt management protocol endpoints:
 * - prompts/list: List available prompts and prompt templates
 * - prompts/get: Get a specific prompt with optional templating
 */

export function registerPromptsEndpoints(server: McpServer) {
  registerListPrompts(server);
  registerGetPrompt(server);
}

/**
 * prompts/list endpoint
 * Returns a paginated list of available prompts and prompt templates
 */
function registerListPrompts(server: McpServer) {
  server.server.setRequestHandler(
    ListPromptsRequestSchema,
    async (request): Promise<ListPromptsResult> => {
      const { cursor } = request.params || {};

      // Demo prompts from separated demo data
      const allPrompts: Prompt[] = DEMO_PROMPTS;

      // Simple pagination implementation
      const pageSize = 10;
      let startIndex = 0;

      if (cursor) {
        try {
          startIndex = parseInt(cursor, 10);
        } catch {
          startIndex = 0;
        }
      }

      const endIndex = startIndex + pageSize;
      const prompts = allPrompts.slice(startIndex, endIndex);

      const result: ListPromptsResult = {
        prompts,
        _meta: {
          totalCount: allPrompts.length,
          pageSize,
          startIndex,
        },
      };

      // Add pagination cursor if there are more results
      if (endIndex < allPrompts.length) {
        result.nextCursor = endIndex.toString();
      }

      return result;
    }
  );
}

/**
 * prompts/get endpoint
 * Gets a specific prompt by name with optional templating arguments
 */
function registerGetPrompt(server: McpServer) {
  server.server.setRequestHandler(
    GetPromptRequestSchema,
    async (request): Promise<GetPromptResult> => {
      const { name, arguments: args } = request.params;

      // Get demo prompt messages from separated demo data
      let description: string;
      let messages: PromptMessage[];

      try {
        messages = getDemoPromptMessages(name, args || {});
        
        // Find the prompt description from the demo data
        const prompt = DEMO_PROMPTS.find(p => p.name === name);
        description = prompt?.description || `Prompt: ${name}`;
      } catch (error) {
        throw new Error(`Prompt not found: ${name}`);
      }

      const result: GetPromptResult = {
        description,
        messages,
        _meta: {
          promptName: name,
          generatedAt: new Date().toISOString(),
          arguments: args,
        },
      };

      return result;
    }
  );
}
