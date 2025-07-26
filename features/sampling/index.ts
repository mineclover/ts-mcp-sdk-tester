import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateMessage } from "./create-message.js";

/**
 * Sampling Features
 * Tests LLM sampling capabilities through the client
 */

export function registerSamplingFeatures(server: McpServer) {
  // Register sampling endpoints
  registerCreateMessage(server);
}