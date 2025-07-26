import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult, ContentBlock, ListToolsResult, Tool } from "../spec/current_spec.js";
import { logger } from "./logger.js";
import { DEMO_TOOLS, executeDemoTool } from "../demo/index.js";
import { paginateArray } from "./pagination-utils.js";

/**
 * Standard MCP Tools Endpoints
 *
 * Implements the core MCP tool management protocol endpoints:
 * - tools/list: List available tools
 * - tools/call: Call a specific tool with arguments
 */

export function registerToolsEndpoints(server: McpServer) {
  logger.logMethodEntry("registerToolsEndpoints", undefined, "tools");
  registerListTools(server);
  registerCallTool(server);
}

/**
 * tools/list endpoint
 * Returns a paginated list of available tools
 */
function registerListTools(server: McpServer) {
  logger.logMethodEntry("registerListTools", undefined, "tools");

  server.server.setRequestHandler(
    ListToolsRequestSchema,
    async (request, extra): Promise<ListToolsResult> => {
      await logger.logEndpointEntry("tools/list", extra.requestId, request.params);

      const { cursor } = request.params || {};

      // Demo tools from separated demo data
      const allTools: Tool[] = DEMO_TOOLS;

      // Use MCP-compliant pagination
      const paginationResult = paginateArray(allTools, cursor, {
        defaultPageSize: 10,
        maxPageSize: 50,
      });

      const result: ListToolsResult = {
        tools: paginationResult.items,
        nextCursor: paginationResult.nextCursor,
        _meta: {
          totalCount: paginationResult._meta.totalCount,
          pageSize: paginationResult._meta.pageSize,
          startIndex: paginationResult._meta.startIndex,
          hasMore: paginationResult._meta.hasMore,
        },
      };

      await logger.logMethodExit("tools/list", { toolCount: paginationResult.items.length }, "tools");
      return result;
    }
  );
}

/**
 * tools/call endpoint
 * Calls a specific tool by name with provided arguments
 */
function registerCallTool(server: McpServer) {
  logger.logMethodEntry("registerCallTool", undefined, "tools");

  server.server.setRequestHandler(
    CallToolRequestSchema,
    async (request, extra): Promise<CallToolResult> => {
      await logger.logEndpointEntry("tools/call", extra.requestId, {
        name: request.params.name,
        hasArgs: !!request.params.arguments,
      });

      const { name, arguments: args } = request.params;

      try {
        // Execute demo tool from separated demo data
        const result = executeDemoTool(name, args || {});

        await logger.logMethodExit("tools/call", { toolName: name, success: !result.isError }, "tools");

        return {
          ...result,
          _meta: {
            toolName: name,
            executedAt: new Date().toISOString(),
            arguments: args,
          },
        };
      } catch (error) {
        // Log server error for debugging
        await logger.logServerError(
          error instanceof Error ? error : new Error(String(error)),
          "tools/call",
          { toolName: name, arguments: args }
        );

        // Return error as a tool result, not as a protocol error
        const errorResult = {
          content: [
            {
              type: "text",
              text: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
            } as ContentBlock,
          ],
          isError: true,
          _meta: {
            toolName: name,
            executedAt: new Date().toISOString(),
            arguments: args,
            error: error instanceof Error ? error.message : String(error),
          },
        };

        await logger.logMethodExit("tools/call", { toolName: name, success: false }, "tools");
        return errorResult;
      }
    }
  );
}
