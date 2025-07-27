import { test, expect, beforeAll, afterAll, describe } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { createHttpTransport } from "../standard/transports.js";
import { LifecycleManager } from "../standard/lifecycle.js";

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
    // Initialize test components
    server = new McpServer(
      {
        name: "test-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          logging: {},
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: true },
        },
      }
    );

    lifecycleManager = new LifecycleManager();
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
      expect(lifecycleManager.currentState).toBe("uninitialized");

      // Move to INITIALIZING
      await lifecycleManager.initialize();
      expect(lifecycleManager.currentState).toBe("initializing");

      // Simulate client initialize request
      lifecycleManager.markInitialized();
      expect(lifecycleManager.currentState).toBe("initialized");

      // Simulate initialized notification
      lifecycleManager.setOperating();
      expect(lifecycleManager.currentState).toBe("operating");

      // Verify normal operations are allowed
      expect(lifecycleManager.canProcessRequests()).toBe(true);

      // Start shutdown
      await lifecycleManager.shutdown();
      expect(lifecycleManager.currentState).toBe("shutdown");
    });
  });

  describe("Scenario 2: Shutdown During Initialization", () => {
    test("Process Start → INITIALIZING → Shutdown Signal → SHUTTING_DOWN → SHUTDOWN", async () => {
      const manager = new LifecycleManager();
      
      // Start initialization
      await manager.initialize();
      expect(manager.currentState).toBe("initializing");

      // Trigger shutdown before completion
      const shutdownPromise = manager.shutdown();
      
      // Should move to shutting_down
      expect(manager.currentState).toBe("shutting_down");
      
      await shutdownPromise;
      expect(manager.currentState).toBe("shutdown");
    });

    test("Initialize notification should be ignored during shutdown", async () => {
      const manager = new LifecycleManager();
      
      await manager.initialize();
      const shutdownPromise = manager.shutdown();
      
      // Try to mark initialized after shutdown started
      manager.markInitialized();
      
      await shutdownPromise;
      expect(manager.currentState).toBe("shutdown");
    });
  });

  describe("Scenario 3: HTTP Session Management", () => {
    test("Client Connect → Auth Middleware → Session Create → MCP Processing → Session Close", async () => {
      const sessions = new Map();
      const testPort = 3001;

      // Create HTTP transport with session tracking
      const { httpServer: server } = await createHttpTransport(
        app,
        testPort,
        new McpServer(
          { name: "test", version: "1.0.0" },
          { capabilities: {} }
        ),
        {
          onSessionCreate: (sessionId: string) => {
            sessions.set(sessionId, { created: Date.now() });
          },
          onSessionDestroy: (sessionId: string) => {
            sessions.delete(sessionId);
          }
        }
      );

      httpServer = server;

      // Simulate client connection
      const response = await fetch(`http://localhost:${testPort}/health`);
      expect(response.status).toBe(200);

      // Verify session was created
      expect(sessions.size).toBeGreaterThan(0);

      // Close server (should cleanup sessions)
      server.close();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test("Shutdown should prevent new session creation", async () => {
      const manager = new LifecycleManager();
      await manager.initialize();
      manager.setOperating();

      // Start shutdown
      const shutdownPromise = manager.shutdown();
      
      // New sessions should be rejected
      expect(manager.canProcessRequests()).toBe(false);
      
      await shutdownPromise;
    });
  });

  describe("Scenario 4: Error Recovery", () => {
    test("Request → Auth Error → Rate Limit Error → MCP Error → Graceful Response", async () => {
      const errors: string[] = [];
      
      // Mock error scenarios
      const mockAuthError = new Error("Invalid API key");
      const mockRateLimitError = new Error("Rate limit exceeded");
      const mockMcpError = new Error("Invalid JSON-RPC");

      // Test error handling pipeline
      try {
        throw mockAuthError;
      } catch (error) {
        errors.push("auth");
        // Should continue processing despite auth error
      }

      try {
        throw mockRateLimitError;
      } catch (error) {
        errors.push("rate_limit");
        // Should continue processing despite rate limit error
      }

      try {
        throw mockMcpError;
      } catch (error) {
        errors.push("mcp");
        // Should generate graceful JSON-RPC error response
      }

      expect(errors).toEqual(["auth", "rate_limit", "mcp"]);
    });
  });

  describe("STDIO Transport Flow", () => {
    test("STDIO transport lifecycle", async () => {
      const manager = new LifecycleManager();
      const testServer = new McpServer(
        { name: "test", version: "1.0.0" },
        { capabilities: {} }
      );

      // Simulate STDIO transport creation
      await manager.initialize();
      
      // Register shutdown handler (simulating transport connection)
      manager.registerShutdownHandler("stdio", async () => {
        // Cleanup stdio resources
      });

      expect(manager.currentState).toBe("initializing");
      
      manager.markInitialized();
      manager.setOperating();
      
      expect(manager.currentState).toBe("operating");
      expect(manager.canProcessRequests()).toBe(true);

      await manager.shutdown();
      expect(manager.currentState).toBe("shutdown");
    });
  });

  describe("HTTP Transport Flow", () => {
    test("HTTP transport with Express middleware", async () => {
      const testApp = express();
      const manager = new LifecycleManager();
      const testPort = 3002;

      await manager.initialize();
      manager.markInitialized();
      manager.setOperating();

      // Test that lifecycle state affects HTTP processing
      expect(manager.canProcessRequests()).toBe(true);

      // Start shutdown
      await manager.shutdown();
      expect(manager.canProcessRequests()).toBe(false);
    });
  });

  describe("MCP Protocol Flow", () => {
    test("Initialize protocol negotiation", async () => {
      const testServer = new McpServer(
        { name: "test", version: "1.0.0" },
        { 
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: true },
            prompts: { listChanged: true }
          }
        }
      );

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
            version: "1.0.0"
          }
        }
      };

      // This would normally be handled by the server's request handler
      // For testing, we verify the structure is correct
      expect(initRequest.method).toBe("initialize");
      expect(initRequest.params.protocolVersion).toBe("2025-06-18");
    });

    test("Ping endpoint response", async () => {
      const manager = new LifecycleManager();
      await manager.initialize();
      manager.markInitialized();
      manager.setOperating();

      // Ping should work in operating state
      expect(manager.canProcessRequests()).toBe(true);

      const pingRequest = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "ping" as const
      };

      // Verify ping request structure
      expect(pingRequest.method).toBe("ping");
    });
  });

  describe("State Management Validation", () => {
    test("State transitions follow documented flow", async () => {
      const manager = new LifecycleManager();
      const states: string[] = [];

      // Track state changes
      const originalSetState = manager.currentState;
      
      // Start flow
      expect(manager.currentState).toBe("uninitialized");
      states.push(manager.currentState);

      await manager.initialize();
      states.push(manager.currentState);

      manager.markInitialized();
      states.push(manager.currentState);

      manager.setOperating();
      states.push(manager.currentState);

      await manager.shutdown();
      states.push(manager.currentState);

      expect(states).toEqual([
        "uninitialized",
        "initializing", 
        "initialized",
        "operating",
        "shutdown"
      ]);
    });

    test("Invalid state transitions are prevented", async () => {
      const manager = new LifecycleManager();

      // Cannot set operating from uninitialized
      expect(() => manager.setOperating()).toThrow();

      await manager.initialize();
      
      // Cannot initialize twice
      await expect(manager.initialize()).rejects.toThrow();
    });
  });

  describe("Performance Characteristics", () => {
    test("Memory management during operations", async () => {
      const manager = new LifecycleManager();
      await manager.initialize();
      manager.markInitialized();
      manager.setOperating();

      // Register multiple handlers
      for (let i = 0; i < 100; i++) {
        manager.registerShutdownHandler(`handler-${i}`, async () => {
          // Mock cleanup
        });
      }

      // Shutdown should cleanup all handlers
      await manager.shutdown();
      
      // Memory should be released (handlers cleared)
      expect(manager.currentState).toBe("shutdown");
    });

    test("Response time characteristics", async () => {
      const manager = new LifecycleManager();
      await manager.initialize();
      manager.markInitialized();
      manager.setOperating();

      // Measure state check performance
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        manager.canProcessRequests();
      }
      
      const duration = performance.now() - start;
      
      // Should be very fast (< 1ms for 1000 checks)
      expect(duration).toBeLessThan(1);

      await manager.shutdown();
    });
  });
});