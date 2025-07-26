import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateElicitation } from "./create-elicitation.js";

/**
 * Elicitation Features
 * Tests user input collection capabilities through the client
 */

export function registerElicitationFeatures(server: McpServer) {
  // Register elicitation endpoints
  registerCreateElicitation(server);
}