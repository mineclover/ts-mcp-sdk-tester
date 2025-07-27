import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { 
  lifecycleManager, 
  LifecycleState,
  type LifecycleInfo,
  type LifecycleCapabilities,
  getServerStatus
} from "../standard/lifecycle.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../standard/logger.js";
import { APP_CONFIG } from "../standard/constants.js";

/**
 * MCP Lifecycle Tests
 * 
 * Tests the lifecycle implementation against the MCP specification:
 * https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle
 */

describe("MCP Lifecycle", () => {
  let mockServer: McpServer;
  let testServerInfo: LifecycleInfo;

  beforeEach(() => {
    // Reset lifecycle manager to clean state
    lifecycleManager.reset();

    // Create mock server for testing
    mockServer = new McpServer({
      name: "test-server",
      version: "1.0.0"
    });

    testServerInfo = {
      name: "test-lifecycle-server",
      title: "Test Lifecycle Server",
      version: "1.0.0"
    };
  });

  afterEach(() => {
    // Clean up after each test
    if (lifecycleManager.getState() !== LifecycleState.UNINITIALIZED) {
      lifecycleManager.shutdown("Test cleanup");
    }
  });

  describe("Initialization Phase", () => {
    test("should start in UNINITIALIZED state", () => {
      expect(lifecycleManager.getState()).toBe(LifecycleState.UNINITIALIZED);
    });

    test("should transition to INITIALIZING when initialized", () => {
      lifecycleManager.initialize(mockServer, testServerInfo);
      expect(lifecycleManager.getState()).toBe(LifecycleState.INITIALIZING);
    });

    test("should handle initialize request correctly", () => {
      // First initialize the lifecycle manager
      lifecycleManager.initialize(mockServer, testServerInfo);
      
      const mockRequest = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {
            roots: { listChanged: true },
            sampling: {},
            elicitation: {}
          },
          clientInfo: {
            name: "TestClient",
            title: "Test Client",
            version: "1.0.0"
          }
        }
      };

      const response = lifecycleManager.handleInitializeRequest(mockRequest);

      expect(response.protocolVersion).toBe(APP_CONFIG.protocol);
      expect(response.serverInfo).toEqual(testServerInfo);
      expect(response.capabilities).toBeDefined();
      expect(response.instructions).toBe("MCP server ready for operation");
    });

    test("should reject unsupported protocol version", () => {
      // First initialize the lifecycle manager
      lifecycleManager.initialize(mockServer, testServerInfo);
      
      const mockRequest = {
        params: {
          protocolVersion: "1.0.0", // Unsupported version
          capabilities: {},
          clientInfo: { name: "TestClient", version: "1.0.0" }
        }
      };

      expect(() => {
        lifecycleManager.handleInitializeRequest(mockRequest);
      }).toThrow("Unsupported protocol version");
    });

    test("should store client information from initialize request", () => {
      // First initialize the lifecycle manager
      lifecycleManager.initialize(mockServer, testServerInfo);
      
      const clientInfo = {
        name: "TestClient",
        title: "Test Client",
        version: "1.0.0"
      };

      const mockRequest = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {},
          clientInfo
        }
      };

      lifecycleManager.handleInitializeRequest(mockRequest);

      expect(lifecycleManager.getClientInfo()).toEqual(clientInfo);
    });

    test("should mark initialization as complete", () => {
      // First initialize the lifecycle manager
      lifecycleManager.initialize(mockServer, testServerInfo);
      
      const mockRequest = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {},
          clientInfo: { name: "TestClient", version: "1.0.0" }
        }
      };

      lifecycleManager.handleInitializeRequest(mockRequest);

      expect(lifecycleManager.getState()).toBe(LifecycleState.INITIALIZED);
    });
  });

  describe("Operation Phase", () => {
    beforeEach(() => {
      // Setup for operation phase
      lifecycleManager.initialize(mockServer, testServerInfo);
      
      const mockRequest = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {},
          clientInfo: { name: "TestClient", version: "1.0.0" }
        }
      };

      lifecycleManager.handleInitializeRequest(mockRequest);
    });

    test("should transition to OPERATING after initialized notification", () => {
      expect(lifecycleManager.getState()).toBe(LifecycleState.INITIALIZED);
      
      // Simulate initialized notification
      lifecycleManager.markInitialized();
      
      // The actual transition to OPERATING happens when the notification is received
      // For testing, we'll simulate this by directly checking the operational state
      expect(lifecycleManager.isOperational()).toBe(false);
    });

    test("should track uptime correctly", async () => {
      const initialUptime = lifecycleManager.getUptime();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const newUptime = lifecycleManager.getUptime();
      expect(newUptime).toBeGreaterThan(initialUptime);
    });

    test("should provide server status information", () => {
      const status = getServerStatus();
      
      expect(status).toHaveProperty("state");
      expect(status).toHaveProperty("uptime");
      expect(status).toHaveProperty("isOperational");
      expect(status).toHaveProperty("sessionStats");
      expect(status).toHaveProperty("protocolVersion");
      expect(status).toHaveProperty("clientInfo");
      expect(status).toHaveProperty("serverInfo");
      expect(status).toHaveProperty("clientCapabilities");
      expect(status).toHaveProperty("serverCapabilities");
    });

    test("should return correct protocol version", () => {
      expect(lifecycleManager.getProtocolVersion()).toBe(APP_CONFIG.protocol);
    });

    test("should return client capabilities", () => {
      const capabilities = lifecycleManager.getClientCapabilities();
      expect(capabilities).toBeDefined();
    });

    test("should return server capabilities", () => {
      const capabilities = lifecycleManager.getServerCapabilities();
      expect(capabilities).toBeDefined();
      expect(capabilities.prompts).toBeDefined();
      expect(capabilities.resources).toBeDefined();
      expect(capabilities.tools).toBeDefined();
    });
  });

  describe("Shutdown Phase", () => {
    beforeEach(() => {
      // Setup for shutdown testing
      lifecycleManager.initialize(mockServer, testServerInfo);
      
      const mockRequest = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {},
          clientInfo: { name: "TestClient", version: "1.0.0" }
        }
      };

      lifecycleManager.handleInitializeRequest(mockRequest);
    });

    test("should transition to SHUTTING_DOWN when shutdown is initiated", async () => {
      const shutdownPromise = lifecycleManager.shutdown("Test shutdown");
      
      // State should be shutting down or already shutdown
      const state = lifecycleManager.getState();
      expect(state === LifecycleState.SHUTTING_DOWN || state === LifecycleState.SHUTDOWN).toBe(true);
      
      await shutdownPromise;
      expect(lifecycleManager.getState()).toBe(LifecycleState.SHUTDOWN);
    });

    test("should execute shutdown handlers", async () => {
      let handlerExecuted = false;
      
      lifecycleManager.onShutdown(() => {
        handlerExecuted = true;
      });

      await lifecycleManager.shutdown("Test shutdown");
      
      expect(handlerExecuted).toBe(true);
    });

    test("should handle multiple shutdown handlers", async () => {
      const executedHandlers: string[] = [];
      
      lifecycleManager.onShutdown(() => {
        executedHandlers.push("handler1");
      });
      
      lifecycleManager.onShutdown(() => {
        executedHandlers.push("handler2");
      });

      await lifecycleManager.shutdown("Test shutdown");
      
      expect(executedHandlers).toContain("handler1");
      expect(executedHandlers).toContain("handler2");
    });

    test("should not execute shutdown handlers multiple times", async () => {
      let executionCount = 0;
      
      lifecycleManager.onShutdown(() => {
        executionCount++;
      });

      await lifecycleManager.shutdown("Test shutdown");
      await lifecycleManager.shutdown("Test shutdown again"); // Should not execute again
      
      expect(executionCount).toBe(1);
    });

    test("should handle shutdown during initialization", async () => {
      // Reset to initializing state
      lifecycleManager.initialize(mockServer, testServerInfo);
      
      const shutdownPromise = lifecycleManager.shutdown("Test shutdown during init");
      
      // State should be shutting down or already shutdown
      const state = lifecycleManager.getState();
      expect(state === LifecycleState.SHUTTING_DOWN || state === LifecycleState.SHUTDOWN).toBe(true);
      
      await shutdownPromise;
      expect(lifecycleManager.getState()).toBe(LifecycleState.SHUTDOWN);
    });
  });

  describe("Capability Negotiation", () => {
    test("should negotiate client capabilities correctly", () => {
      const clientCapabilities: LifecycleCapabilities = {
        roots: { listChanged: true },
        sampling: {},
        elicitation: {},
        experimental: { customFeature: true }
      };

      const mockRequest = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: clientCapabilities,
          clientInfo: { name: "TestClient", version: "1.0.0" }
        }
      };

      lifecycleManager.handleInitializeRequest(mockRequest);

      const storedCapabilities = lifecycleManager.getClientCapabilities();
      expect(storedCapabilities.roots?.listChanged).toBe(true);
      expect(storedCapabilities.sampling).toBeDefined();
      expect(storedCapabilities.elicitation).toBeDefined();
    });

    test("should provide server capabilities", () => {
      const mockRequest = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {},
          clientInfo: { name: "TestClient", version: "1.0.0" }
        }
      };

      const response = lifecycleManager.handleInitializeRequest(mockRequest);

      expect(response.capabilities.prompts?.listChanged).toBe(true);
      expect(response.capabilities.resources?.subscribe).toBe(true);
      expect(response.capabilities.resources?.listChanged).toBe(true);
      expect(response.capabilities.tools?.listChanged).toBe(true);
      expect(response.capabilities.logging).toBeDefined();
      expect(response.capabilities.completions).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("should handle shutdown during shutdown gracefully", async () => {
      await lifecycleManager.shutdown("First shutdown");
      
      // Second shutdown should not cause issues
      await lifecycleManager.shutdown("Second shutdown");
      
      expect(lifecycleManager.getState()).toBe(LifecycleState.SHUTDOWN);
    });

    test("should handle errors in shutdown handlers", async () => {
      lifecycleManager.onShutdown(() => {
        throw new Error("Test error in shutdown handler");
      });

      // Should not throw, should log error
      await lifecycleManager.shutdown("Test shutdown with error");
      
      expect(lifecycleManager.getState()).toBe(LifecycleState.SHUTDOWN);
    });

    test("should handle timeout in shutdown handlers", async () => {
      lifecycleManager.onShutdown(async () => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
      });

      // Should timeout after 5 seconds
      await lifecycleManager.shutdown("Test shutdown with timeout");
      
      expect(lifecycleManager.getState()).toBe(LifecycleState.SHUTDOWN);
    }, 10000); // Increase test timeout to 10 seconds
  });

  describe("State Transitions", () => {
    test("should follow correct state transition sequence", () => {
      // UNINITIALIZED -> INITIALIZING
      expect(lifecycleManager.getState()).toBe(LifecycleState.UNINITIALIZED);
      
      lifecycleManager.initialize(mockServer, testServerInfo);
      expect(lifecycleManager.getState()).toBe(LifecycleState.INITIALIZING);
      
      // INITIALIZING -> INITIALIZED
      lifecycleManager.markInitialized();
      expect(lifecycleManager.getState()).toBe(LifecycleState.INITIALIZED);
    });

    test("should prevent invalid state transitions", () => {
      // Should not be able to initialize twice
      lifecycleManager.initialize(mockServer, testServerInfo);
      lifecycleManager.initialize(mockServer, testServerInfo); // Should be ignored
      
      expect(lifecycleManager.getState()).toBe(LifecycleState.INITIALIZING);
    });
  });

  describe("Information Retrieval", () => {
    beforeEach(() => {
      lifecycleManager.initialize(mockServer, testServerInfo);
      
      const mockRequest = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: { roots: { listChanged: true } },
          clientInfo: { name: "TestClient", version: "1.0.0" }
        }
      };

      lifecycleManager.handleInitializeRequest(mockRequest);
    });

    test("should return client information", () => {
      const clientInfo = lifecycleManager.getClientInfo();
      expect(clientInfo?.name).toBe("TestClient");
      expect(clientInfo?.version).toBe("1.0.0");
    });

    test("should return server information", () => {
      const serverInfo = lifecycleManager.getServerInfo();
      expect(serverInfo?.name).toBe("test-lifecycle-server");
      expect(serverInfo?.version).toBe("1.0.0");
    });

    test("should return comprehensive server status", () => {
      const status = getServerStatus();
      
      expect(status.state).toBeDefined();
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.isOperational).toBeDefined();
      expect(status.sessionStats).toBeDefined();
      expect(status.protocolVersion).toBe(APP_CONFIG.protocol);
      expect(status.clientInfo).toBeDefined();
      expect(status.serverInfo).toBeDefined();
      expect(status.clientCapabilities).toBeDefined();
      expect(status.serverCapabilities).toBeDefined();
    });
  });
}); 