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
      const traceId = await logger.logEndpointEntry("tools/list", extra.requestId, {
        cursor: request.params?.cursor ? "[present]" : "[none]",
      });

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
          totalCount: paginationResult._meta?.totalCount,
          pageSize: paginationResult._meta?.pageSize,
          startIndex: paginationResult._meta?.startIndex,
          hasMore: paginationResult._meta?.hasMore,
        },
      };

      await logger.logMethodExit("tools/list", {
        requestId: extra.requestId,
        toolCount: paginationResult.items.length,
        totalCount: result._meta?.totalCount,
        hasMore: result._meta?.hasMore,
      }, "tools", traceId);
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
      const traceId = await logger.logEndpointEntry("tools/call", extra.requestId, {
        toolName: request.params.name,
        hasArguments: !!request.params.arguments,
        argumentCount: request.params.arguments ? Object.keys(request.params.arguments).length : 0,
      });

      const { name, arguments: args } = request.params;

      try {
        const startTime = Date.now();
        
        // Start nested operation for tool execution  
        const toolTraceId = logger.startOperation(`tool.${name}`, {
          'tool.name': name,
          'tool.args.count': args ? Object.keys(args).length : 0,
          'tool.execution.start': startTime,
        });
        
        // Execute demo tool from separated demo data
        const result = executeDemoTool(name, args || {});
        const executionTime = Date.now() - startTime;
        
        // End tool execution trace
        if (toolTraceId) {
          logger.endOperation(toolTraceId, {
            'tool.execution.success': !result.isError,
            'tool.execution.time.ms': executionTime,
            'tool.result.content.count': result.content?.length || 0,
          });
        }

        await logger.logMethodExit("tools/call", {
          requestId: extra.requestId,
          toolName: name,
          success: !result.isError,
          executionTime,
          contentCount: result.content?.length || 0,
        }, "tools", traceId);

        return {
          ...result,
          _meta: {
            toolName: name,
            executedAt: new Date().toISOString(),
            executionTime,
            arguments: args,
            requestId: extra.requestId,
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

        await logger.logMethodExit("tools/call", {
          requestId: extra.requestId,
          toolName: name,
          success: false,
        }, "tools", traceId);
        return errorResult;
      }
    }
  );
}
