import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CompleteRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type {
  CompleteResult,
} from "../../spec/current_spec.js";

/**
 * Registers the completion/complete method handler
 * Provides argument autocompletion suggestions for prompts and resources
 */
export function registerComplete(server: McpServer): void {
  server.server.setRequestHandler(
    CompleteRequestSchema,
    async (request): Promise<CompleteResult> => {
      try {
        const { ref, argument, context } = request.params;

        // Generate completion suggestions based on reference type
        let completionValues: string[] = [];

        if (ref.type === "ref/prompt") {
          completionValues = await getPromptCompletions(ref, argument, context);
        } else if (ref.type === "ref/resource") {
          completionValues = await getResourceCompletions(ref, argument, context);
        }

        // Limit to 100 items as per spec
        const limitedValues = completionValues.slice(0, 100);

        return {
          completion: {
            values: limitedValues,
            total: completionValues.length,
            hasMore: completionValues.length > 100,
          },
          _meta: {
            timestamp: new Date().toISOString(),
            refType: ref.type,
            argumentName: argument.name,
          },
        };
      } catch (error) {
        console.error("Error providing completions:", error);
        throw new Error(
          `Failed to provide completions: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }
  );
}

/**
 * Get completion suggestions for prompt arguments
 */
async function getPromptCompletions(
  ref: { type: "ref/prompt"; name: string; title?: string },
  argument: { name: string; value: string },
  _context?: { arguments?: Record<string, string> }
): Promise<string[]> {
  const { name: argName, value } = argument;

  // Generate contextual completions based on prompt and argument
  const completions: string[] = [];

  // Common argument completions
  if (argName === "format") {
    completions.push("json", "xml", "yaml", "csv", "markdown", "text");
  } else if (argName === "language") {
    completions.push("javascript", "typescript", "python", "java", "go", "rust");
  } else if (argName === "style") {
    completions.push("formal", "casual", "technical", "simple", "detailed");
  } else if (argName === "topic") {
    completions.push("programming", "design", "testing", "deployment", "documentation");
  } else if (argName === "difficulty") {
    completions.push("beginner", "intermediate", "advanced", "expert");
  }

  // Filter based on current input value
  const filtered = completions.filter(completion =>
    completion.toLowerCase().includes(value.toLowerCase())
  );

  // If no specific matches, provide generic suggestions
  if (filtered.length === 0 && value.length > 0) {
    return [`${value}_option1`, `${value}_option2`, `${value}_example`];
  }

  return filtered.length > 0 ? filtered : completions;
}

/**
 * Get completion suggestions for resource template arguments
 */
async function getResourceCompletions(
  ref: { type: "ref/resource"; uri: string },
  argument: { name: string; value: string },
  _context?: { arguments?: Record<string, string> }
): Promise<string[]> {
  const { uri } = ref;
  const { name: argName, value } = argument;

  const completions: string[] = [];

  // URI template variable completions
  if (uri.includes(`{${argName}}`)) {
    if (argName === "id") {
      completions.push("1", "2", "3", "example-id", "test-id");
    } else if (argName === "type") {
      completions.push("text", "image", "video", "audio", "document");
    } else if (argName === "category") {
      completions.push("general", "technical", "business", "educational");
    } else if (argName === "version") {
      completions.push("1.0", "2.0", "latest", "stable", "beta");
    } else if (argName === "format") {
      completions.push("json", "xml", "csv", "txt", "md");
    }
  }

  // Filter based on current input value
  const filtered = completions.filter(completion =>
    completion.toLowerCase().includes(value.toLowerCase())
  );

  // Generate dynamic completions if no predefined ones match
  if (filtered.length === 0 && value.length > 0) {
    return [`${value}1`, `${value}2`, `${value}-example`];
  }

  return filtered.length > 0 ? filtered : completions;
}