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
import { logger } from "./logger.js";
import { paginateArray } from "./pagination-utils.js";

/**
 * Standard MCP Prompts Endpoints
 *
 * Implements the core MCP prompt management protocol endpoints:
 * - prompts/list: List available prompts and prompt templates
 * - prompts/get: Get a specific prompt with optional templating
 */

export function registerPromptsEndpoints(server: McpServer) {
  logger.logMethodEntry("registerPromptsEndpoints", { serverType: 'McpServer' }, "prompts");
  
  registerListPrompts(server);
  registerGetPrompt(server);
  
  logger.info("All prompt endpoints registered successfully", "prompts");
}

/**
 * prompts/list endpoint
 * Returns a paginated list of available prompts and prompt templates
 */
function registerListPrompts(server: McpServer) {
  logger.logMethodEntry("registerListPrompts", undefined, "prompts");
  
  server.server.setRequestHandler(
    ListPromptsRequestSchema,
    async (request, extra): Promise<ListPromptsResult> => {
      const traceId = await logger.logEndpointEntry("prompts/list", extra.requestId, {
        cursor: request.params?.cursor ? "[present]" : "[none]",
      });

      try {
        const { cursor } = request.params || {};

        // Demo prompts from separated demo data
        const allPrompts: Prompt[] = DEMO_PROMPTS;
        logger.debug(`Loading ${allPrompts.length} total prompts`, "prompts");

        // Use MCP-compliant pagination
        const paginationResult = paginateArray(allPrompts, cursor, {
          defaultPageSize: 10,
          maxPageSize: 50,
        });

        const result: ListPromptsResult = {
          prompts: paginationResult.items,
          nextCursor: paginationResult.nextCursor,
          _meta: {
            totalCount: paginationResult._meta?.totalCount,
            pageSize: paginationResult._meta?.pageSize,
            startIndex: paginationResult._meta?.startIndex,
            hasMore: paginationResult._meta?.hasMore,
          },
        };

        await logger.logMethodExit("prompts/list", {
          requestId: extra.requestId,
          promptCount: result.prompts.length,
          totalCount: result._meta?.totalCount,
          hasMore: result._meta?.hasMore,
        }, "prompts", traceId);

        return result;
      } catch (error) {
        await logger.logServerError(
          error instanceof Error ? error : new Error(String(error)),
          "prompts/list",
          { requestId: extra.requestId, cursor: request.params?.cursor }
        );
        throw error;
      }
    }
  );
}

/**
 * prompts/get endpoint
 * Gets a specific prompt by name with optional templating arguments
 */
function registerGetPrompt(server: McpServer) {
  logger.logMethodEntry("registerGetPrompt", undefined, "prompts");
  
  server.server.setRequestHandler(
    GetPromptRequestSchema,
    async (request, extra): Promise<GetPromptResult> => {
      const { name, arguments: args } = request.params;
      
      const traceId = await logger.logEndpointEntry("prompts/get", extra.requestId, {
        promptName: name,
        hasArguments: !!args && Object.keys(args).length > 0,
      });

      try {
        logger.debug(`Getting prompt: ${name}`, "prompts");
        
        // Get demo prompt messages from separated demo data
        let description: string;
        let messages: PromptMessage[];

        try {
          messages = getDemoPromptMessages(name, args || {});
          logger.debug(`Generated ${messages.length} messages for prompt: ${name}`, "prompts");
          
          // Find the prompt description from the demo data
          const prompt = DEMO_PROMPTS.find(p => p.name === name);
          description = prompt?.description || `Prompt: ${name}`;
        } catch (error) {
          logger.warning(`Prompt not found: ${name}`, "prompts");
          throw new Error(`Prompt not found: ${name}`);
        }

        const result: GetPromptResult = {
          description,
          messages,
          _meta: {
            promptName: name,
            generatedAt: new Date().toISOString(),
            arguments: args,
            messageCount: messages.length,
            requestId: extra.requestId,
          },
        };

        await logger.logMethodExit("prompts/get", {
          requestId: extra.requestId,
          promptName: name,
          messageCount: messages.length,
          argumentCount: args ? Object.keys(args).length : 0,
        }, "prompts", traceId);

        return result;
      } catch (error) {
        await logger.logServerError(
          error instanceof Error ? error : new Error(String(error)),
          "prompts/get",
          { requestId: extra.requestId, promptName: name, arguments: args }
        );
        throw error;
      }
    }
  );
}
