import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerComplete } from "./complete.js";

/**
 * Completion Features
 * Provides argument autocompletion suggestions for prompts and resources
 */

export function registerCompletionFeatures(server: McpServer) {
  // Register completion/complete method
  registerComplete(server);
}