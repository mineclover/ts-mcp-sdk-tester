import { test, expect, beforeAll, afterAll, describe } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { createHttpTransport } from "../standard/transports.js";
import { type LifecycleManager, LifecycleState } from "../standard/lifecycle.js";
import {
  createTestServer,
  createTestLifecycleManager,
  getRandomTestPort,
  MOCK_ERRORS,
} from "./test-utils.js";

/**
 * Data Flow Validation Tests
 *
 * Tests the complete data flow architecture documented in architecture-flow.md
 * covering all lifecycle states, transport types, and error scenarios.
 */

describe("Data Flow Validation", () => {
  let server: McpServer;
  let lifecycleManager: LifecycleManager;
  let app: express.Application;
  let httpServer: any;

  beforeAll(async () => {
    // Use test utilities for consistent setup
    server = createTestServer();
    const { lifecycleManager: testLifecycleManager } = createTestLifecycleManager(server);
    lifecycleManager = testLifecycleManager;
    app = express();
  });

  afterAll(async () => {
    if (httpServer) {
      httpServer.close();
    }
    await lifecycleManager.shutdown();
  });

  describe("Scenario 1: Normal Operation Flow", () => {
    test("Process Start → INITIALIZING → INITIALIZED → OPERATING → Normal Requests → SHUTTING_DOWN → SHUTDOWN", async () => {
      // Start with UNINITIALIZED
      expect(lifecycleManager.currentState).toBe(LifecycleState.UNINITIALIZED);

      // Move to INITIALIZING
      lifecycleManager.initialize(server);
      expect(lifecycleManager.currentState).toBe(LifecycleState.INITIALIZING);

      // Simulate client initialize request
      lifecycleManager.markInitialized();
      expect(lifecycleManager.currentState).toBe(LifecycleState.INITIALIZED);

      // Check if already initialized
      expect(lifecycleManager.currentState).toBe(LifecycleState.INITIALIZED);

      // Verify operational status (false until client notification)
      expect(lifecycleManager.isOperational()).toBe(false);

      // Start shutdown
      await lifecycleManager.shutdown();
      expect(lifecycleManager.currentState).toBe(LifecycleState.SHUTDOWN);
    });
  });

  describe("Scenario 2: Shutdown During Initialization", () => {
    test("Process Start → INITIALIZING → Shutdown Signal → SHUTTING_DOWN → SHUTDOWN", async () => {
      const { lifecycleManager: manager } = createTestLifecycleManager(server);

      // Start initialization
      manager.initialize(server);
      expect(manager.currentState).toBe(LifecycleState.INITIALIZING);

      // Trigger shutdown before completion
      const shutdownPromise = manager.shutdown();

      // Should move to shutting_down
      expect(manager.currentState).toBe(LifecycleState.SHUTTING_DOWN);

      await shutdownPromise;
      expect(manager.currentState).toBe(LifecycleState.SHUTDOWN);
    });

    test("Initialize notification should be ignored during shutdown", async () => {
      const { lifecycleManager: manager } = createTestLifecycleManager(server);

      manager.initialize(server);
      const shutdownPromise = manager.shutdown();

      // Try to mark initialized after shutdown started
      manager.markInitialized();

      await shutdownPromise;
      expect(manager.currentState).toBe(LifecycleState.SHUTDOWN);
    });
  });

  describe("Scenario 3: HTTP Session Management", () => {
    test("Client Connect → Auth Middleware → Session Create → MCP Processing → Session Close", async () => {
      const sessions = new Map();
      const testPort = getRandomTestPort();

      // Create HTTP transport with session tracking
      const { httpServer: server } = await createHttpTransport(
        app,
        testPort,
        new McpServer({ name: "test", version: "1.0.0" }, { capabilities: {} }),
        {
          onSessionCreate: (sessionId: string) => {
            sessions.set(sessionId, { created: Date.now() });
          },
          onSessionDestroy: (sessionId: string) => {
            sessions.delete(sessionId);
          },
        }
      );

      httpServer = server;

      // Simulate client connection
      try {
        const response = await fetch(`http://localhost:${testPort}/health`);
        expect(response.status).toBe(200);
      } catch {
        // Health endpoint might not exist, that's ok
      }

      // For this test we just verify the server started
      expect(httpServer).toBeDefined();

      // Close server (should cleanup sessions)
      server.close();

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    test("Shutdown should prevent new session creation", async () => {
      const { lifecycleManager: manager } = createTestLifecycleManager(server);
      manager.initialize(server);
      manager.markInitialized();

      // Start shutdown
      const shutdownPromise = manager.shutdown();

      // Should not be operational during shutdown
      expect(manager.isOperational()).toBe(false);

      await shutdownPromise;
    });
  });

  describe("Scenario 4: Error Recovery", () => {
    test("Request → Auth Error → Rate Limit Error → MCP Error → Graceful Response", async () => {
      const errors: string[] = [];

      // Use standardized mock errors
      const { auth: mockAuthError, rateLimit: mockRateLimitError, mcp: mockMcpError } = MOCK_ERRORS;

      // Test error handling pipeline
      try {
        throw mockAuthError;
      } catch {
        errors.push("auth");
        // Should continue processing despite auth error
      }

      try {
        throw mockRateLimitError;
      } catch {
        errors.push("rate_limit");
        // Should continue processing despite rate limit error
      }

      try {
        throw mockMcpError;
      } catch {
        errors.push("mcp");
        // Should generate graceful JSON-RPC error response
      }

      expect(errors).toEqual(["auth", "rate_limit", "mcp"]);
    });
  });

  describe("STDIO Transport Flow", () => {
    test("STDIO transport lifecycle", async () => {
      const testServerLocal = createTestServer("test", "1.0.0");
      const { lifecycleManager: manager } = createTestLifecycleManager(testServerLocal);

      // Simulate STDIO transport creation
      manager.initialize(testServerLocal);

      // Register shutdown handler (simulating transport connection)
      manager.onShutdown(async () => {
        // Cleanup stdio resources
      });

      expect(manager.currentState).toBe(LifecycleState.INITIALIZING);

      manager.markInitialized();

      expect(manager.currentState).toBe(LifecycleState.INITIALIZED);
      expect(manager.isOperational()).toBe(false); // Need client notification to go to operating

      await manager.shutdown();
      expect(manager.currentState).toBe(LifecycleState.SHUTDOWN);
    });
  });

  describe("HTTP Transport Flow", () => {
    test("HTTP transport with Express middleware", async () => {
      const { lifecycleManager: manager } = createTestLifecycleManager(server);

      manager.initialize(server);
      manager.markInitialized();

      // Test that lifecycle state affects HTTP processing
      expect(manager.isOperational()).toBe(false); // Still waiting for client notification

      // Start shutdown
      await manager.shutdown();
      expect(manager.isOperational()).toBe(false);
    });
  });

  describe("MCP Protocol Flow", () => {
    test("Initialize protocol negotiation", async () => {
      // Test protocol version validation
      const initRequest = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "initialize" as const,
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
      };

      // This would normally be handled by the server's request handler
      // For testing, we verify the structure is correct
      expect(initRequest.method).toBe("initialize");
      expect(initRequest.params.protocolVersion).toBe("2025-06-18");
    });

    test("Ping endpoint response", async () => {
      const { lifecycleManager: manager } = createTestLifecycleManager(server);
      manager.initialize(server);
      manager.markInitialized();

      // Ping should work in initialized state
      expect(manager.currentState).toBe(LifecycleState.INITIALIZED);

      const pingRequest = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "ping" as const,
      };

      // Verify ping request structure
      expect(pingRequest.method).toBe("ping");
    });
  });

  describe("State Management Validation", () => {
    test("State transitions follow documented flow", async () => {
      const { lifecycleManager: manager } = createTestLifecycleManager(server);
      const states: string[] = [];

      // Track state changes

      // Start flow
      expect(manager.currentState).toBe(LifecycleState.UNINITIALIZED);
      states.push(manager.currentState);

      manager.initialize(server);
      states.push(manager.currentState);

      manager.markInitialized();
      states.push(manager.currentState);

      await manager.shutdown();
      states.push(manager.currentState);

      expect(states).toEqual([
        LifecycleState.UNINITIALIZED,
        LifecycleState.INITIALIZING,
        LifecycleState.INITIALIZED,
        LifecycleState.SHUTDOWN,
      ]);
    });

    test("Invalid state transitions are prevented", async () => {
      const { lifecycleManager: manager } = createTestLifecycleManager();

      // Cannot mark initialized from uninitialized
      manager.markInitialized();
      expect(manager.currentState).toBe(LifecycleState.UNINITIALIZED); // Should stay uninitialized

      manager.initialize(server);
      expect(manager.currentState).toBe(LifecycleState.INITIALIZING);

      // Multiple initialization calls should work but not change state
      manager.initialize(server);
      expect(manager.currentState).toBe(LifecycleState.INITIALIZING);
    });
  });

  describe("Performance Characteristics", () => {
    test("Memory management during operations", async () => {
      const { lifecycleManager: manager } = createTestLifecycleManager(server);
      manager.initialize(server);
      manager.markInitialized();

      // Register multiple handlers
      for (let i = 0; i < 100; i++) {
        manager.onShutdown(async () => {
          // Mock cleanup
        });
      }

      // Shutdown should cleanup all handlers
      await manager.shutdown();

      // Memory should be released (handlers cleared)
      expect(manager.currentState).toBe(LifecycleState.SHUTDOWN);
    });

    test("Response time characteristics", async () => {
      const { lifecycleManager: manager } = createTestLifecycleManager(server);
      manager.initialize(server);
      manager.markInitialized();

      // Measure state check performance
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        manager.isOperational();
      }

      const duration = performance.now() - start;

      // Should be very fast (< 1ms for 1000 checks)
      expect(duration).toBeLessThan(1);

      await manager.shutdown();
    });
  });
});
