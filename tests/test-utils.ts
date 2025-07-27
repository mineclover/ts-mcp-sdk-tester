/**
 * Test Utilities and Constants
 * 
 * Shared utilities to reduce code duplication and improve test efficiency
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LifecycleManager } from "../standard/lifecycle.js";

/**
 * Default MCP server configuration for tests
 */
export const DEFAULT_TEST_SERVER_CONFIG = {
  name: "test-server",
  version: "1.0.0",
} as const;

export const DEFAULT_TEST_CAPABILITIES = {
  capabilities: {
    logging: {},
    tools: { listChanged: true },
    resources: { subscribe: true, listChanged: true },
    prompts: { listChanged: true },
  },
} as const;

/**
 * Create a standard test MCP server
 */
export function createTestServer(
  name: string = DEFAULT_TEST_SERVER_CONFIG.name,
  version: string = DEFAULT_TEST_SERVER_CONFIG.version
): McpServer {
  return new McpServer(
    { name, version },
    DEFAULT_TEST_CAPABILITIES
  );
}

/**
 * Create and initialize a lifecycle manager with a test server
 */
export function createTestLifecycleManager(server?: McpServer): {
  lifecycleManager: LifecycleManager;
  server: McpServer;
} {
  const testServer = server || createTestServer();
  const lifecycleManager = new LifecycleManager();
  
  return { lifecycleManager, server: testServer };
}

/**
 * Fully initialize a lifecycle manager for testing
 */
export function initializeTestLifecycle(server?: McpServer): {
  lifecycleManager: LifecycleManager;
  server: McpServer;
} {
  const { lifecycleManager, server: testServer } = createTestLifecycleManager(server);
  
  // Initialize without throwing on missing notification handlers
  lifecycleManager.initialize(testServer);
  lifecycleManager.markInitialized();
  
  return { lifecycleManager, server: testServer };
}

/**
 * Generate random test port to avoid conflicts
 */
export function getRandomTestPort(): number {
  return 3000 + Math.floor(Math.random() * 1000);
}

/**
 * Standard test timeout
 */
export const TEST_TIMEOUT = 5000;

/**
 * Wait utility for tests
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock session data for tests
 */
export const MOCK_SESSION_DATA = {
  sessionId: "test-session-123",
  clientId: "test-client",
  capabilities: ["tools", "resources", "prompts"],
} as const;

/**
 * Mock error objects for testing
 */
export const MOCK_ERRORS = {
  auth: new Error("Invalid API key"),
  rateLimit: new Error("Rate limit exceeded"),
  mcp: new Error("Invalid JSON-RPC"),
  network: new Error("Network timeout"),
} as const;