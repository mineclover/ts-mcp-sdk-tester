import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CompleteRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CompleteResult } from "../spec/current_spec.js";
import { getDemoPromptCompletions, getDemoResourceCompletions } from "../demo/index.js";

/**
 * Standard MCP Completion Endpoints
 *
 * Implements the core MCP completion protocol endpoints:
 * - completion/complete: Provide argument completion suggestions
 */

export function registerCompletionEndpoints(server: McpServer) {
  registerComplete(server);
}

/**
 * completion/complete endpoint
 * Provide completion suggestions for prompt or resource template arguments
 */
function registerComplete(server: McpServer) {
  server.server.setRequestHandler(
    CompleteRequestSchema,
    async (request): Promise<CompleteResult> => {
      const { ref, argument, context } = request.params;

      // Generate completion suggestions from separated demo data
      let completionValues: string[] = [];

      if (ref.type === "ref/prompt") {
        // Get demo prompt completions
        completionValues = getDemoPromptCompletions(argument.name, argument.value);
      } else if (ref.type === "ref/resource") {
        // Get demo resource completions
        completionValues = getDemoResourceCompletions(ref.uri, argument.value);
      }

      // Limit to 100 items as per spec
      const limitedValues = completionValues.slice(0, 100);

      const result: CompleteResult = {
        completion: {
          values: limitedValues,
          total: completionValues.length,
          hasMore: completionValues.length > 100,
        },
        _meta: {
          argumentName: argument.name,
          argumentValue: argument.value,
          referenceType: ref.type,
          context: context,
          generatedAt: new Date().toISOString(),
        },
      };

      return result;
    }
  );
}
