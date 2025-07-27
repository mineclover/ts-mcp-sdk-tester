#!/usr/bin/env bun

/**
 * Session Lifecycle Tests
 * 
 * Tests for session isolation in MCP lifecycle management
 */

import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { 
  SessionLifecycleManagerFactory,
  SessionLifecycleManager,
  LifecycleState,
  type LifecycleInfo 
} from "../standard/lifecycle.js";
import { logger } from "../standard/logger.js";
import { APP_CONFIG } from "../standard/constants.js";

// Test server info
const testServerInfo: LifecycleInfo = {
  name: "session-lifecycle-test",
  title: "Session Lifecycle Test Server",
  version: "1.0.0",
};

// Mock MCP server for testing
const mockServer = {} as any;

describe("Session Lifecycle Management", () => {
  beforeEach(() => {
    // Clear all session managers before each test
    const allManagers = SessionLifecycleManagerFactory.getAllSessionLifecycleManagers();
    for (const [sessionId] of allManagers) {
      SessionLifecycleManagerFactory.removeSessionLifecycleManager(sessionId);
    }
  });

  afterEach(() => {
    // Cleanup after each test
    const allManagers = SessionLifecycleManagerFactory.getAllSessionLifecycleManagers();
    for (const [sessionId] of allManagers) {
      SessionLifecycleManagerFactory.removeSessionLifecycleManager(sessionId);
    }
  });

  describe("Session Creation and Initialization", () => {
    test("should create session lifecycle manager", () => {
      const sessionId = "test_session_1";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      expect(manager).toBeDefined();
      expect(manager.getState()).toBe(LifecycleState.UNINITIALIZED);
    });

    test("should initialize session lifecycle manager", () => {
      const sessionId = "test_session_2";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      manager.initialize(mockServer, testServerInfo);
      
      expect(manager.getState()).toBe(LifecycleState.INITIALIZING);
      expect(manager.getServerInfo()).toEqual(testServerInfo);
    });

    test("should handle initialize request for session", () => {
      const sessionId = "test_session_3";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      manager.initialize(mockServer, testServerInfo);
      
      const mockRequest = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: true },
          },
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
      };

      const response = manager.handleInitializeRequest(mockRequest);
      
      expect(response.protocolVersion).toBe(APP_CONFIG.protocol);
      expect(response.serverInfo).toEqual(testServerInfo);
      expect(manager.getState()).toBe(LifecycleState.INITIALIZED);
      expect(manager.getClientInfo()).toEqual(mockRequest.params.clientInfo);
    });

    test("should reject incompatible protocol version", () => {
      const sessionId = "test_session_4";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      manager.initialize(mockServer, testServerInfo);
      
      const mockRequest = {
        params: {
          protocolVersion: "2023-01-01", // Old version
          capabilities: {},
          clientInfo: { name: "old-client", version: "1.0.0" },
        },
      };

      expect(() => {
        manager.handleInitializeRequest(mockRequest);
      }).toThrow("Unsupported protocol version");
    });
  });

  describe("Session Isolation", () => {
    test("should maintain independent state between sessions", () => {
      const session1 = SessionLifecycleManagerFactory.getSessionLifecycleManager("session_1");
      const session2 = SessionLifecycleManagerFactory.getSessionLifecycleManager("session_2");
      
      // Initialize both sessions
      session1.initialize(mockServer, testServerInfo);
      session2.initialize(mockServer, testServerInfo);
      
      expect(session1.getState()).toBe(LifecycleState.INITIALIZING);
      expect(session2.getState()).toBe(LifecycleState.INITIALIZING);
      
      // Initialize session1 only
      const request1 = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {},
          clientInfo: { name: "client1", version: "1.0.0" },
        },
      };
      
      session1.handleInitializeRequest(request1);
      
      expect(session1.getState()).toBe(LifecycleState.INITIALIZED);
      expect(session2.getState()).toBe(LifecycleState.INITIALIZING); // Should remain unchanged
    });

    test("should have independent client capabilities per session", () => {
      const session1 = SessionLifecycleManagerFactory.getSessionLifecycleManager("session_3");
      const session2 = SessionLifecycleManagerFactory.getSessionLifecycleManager("session_4");
      
      session1.initialize(mockServer, testServerInfo);
      session2.initialize(mockServer, testServerInfo);
      
      const request1 = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: { tools: { listChanged: true } },
          clientInfo: { name: "client1", version: "1.0.0" },
        },
      };
      
      const request2 = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: { resources: { subscribe: true } },
          clientInfo: { name: "client2", version: "1.0.0" },
        },
      };
      
      session1.handleInitializeRequest(request1);
      session2.handleInitializeRequest(request2);
      
      expect(session1.getClientCapabilities()).toEqual(request1.params.capabilities);
      expect(session2.getClientCapabilities()).toEqual(request2.params.capabilities);
      expect(session1.getClientCapabilities()).not.toEqual(session2.getClientCapabilities());
    });

    test("should have independent uptime per session", async () => {
      const session1 = SessionLifecycleManagerFactory.getSessionLifecycleManager("session_5");
      const session2 = SessionLifecycleManagerFactory.getSessionLifecycleManager("session_6");
      
      session1.initialize(mockServer, testServerInfo);
      
      // Wait a bit before initializing session2
      await new Promise(resolve => setTimeout(resolve, 100));
      
      session2.initialize(mockServer, testServerInfo);
      
      const uptime1 = session1.getUptime();
      const uptime2 = session2.getUptime();
      
      expect(uptime1).toBeGreaterThan(uptime2);
    });
  });

  describe("Session Shutdown", () => {
    test("should shutdown session independently", async () => {
      const session1 = SessionLifecycleManagerFactory.getSessionLifecycleManager("session_7");
      const session2 = SessionLifecycleManagerFactory.getSessionLifecycleManager("session_8");
      
      session1.initialize(mockServer, testServerInfo);
      session2.initialize(mockServer, testServerInfo);
      
      // Initialize both sessions
      const request = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      };
      
      session1.handleInitializeRequest(request);
      session2.handleInitializeRequest(request);
      
      expect(session1.getState()).toBe(LifecycleState.INITIALIZED);
      expect(session2.getState()).toBe(LifecycleState.INITIALIZED);
      
      // Shutdown session1 only
      await session1.shutdown("Test shutdown");
      
      expect(session1.getState()).toBe(LifecycleState.SHUTDOWN);
      expect(session2.getState()).toBe(LifecycleState.INITIALIZED); // Should remain unchanged
    });

    test("should execute session-specific shutdown handlers", async () => {
      const sessionId = "test_session_9";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      let handlerExecuted = false;
      let handlerSessionId = "";
      
      manager.onShutdown(() => {
        handlerExecuted = true;
        handlerSessionId = sessionId;
      });
      
      manager.initialize(mockServer, testServerInfo);
      await manager.shutdown("Test shutdown");
      
      expect(handlerExecuted).toBe(true);
      expect(handlerSessionId).toBe(sessionId);
    });

    test("should prevent operations during shutdown", () => {
      const sessionId = "test_session_10";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      manager.initialize(mockServer, testServerInfo);
      
      const request = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      };
      
      manager.handleInitializeRequest(request);
      
      // Start shutdown
      manager.shutdown("Test shutdown");
      
      expect(() => {
        manager.handleInitializeRequest(request);
      }).toThrow("Session is shutting down");
    });
  });

  describe("Session Lifecycle Manager Factory", () => {
    test("should get or create session lifecycle manager", () => {
      const sessionId = "factory_test_1";
      
      const manager1 = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      const manager2 = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      expect(manager1).toBe(manager2); // Should be the same instance
    });

    test("should remove session lifecycle manager", () => {
      const sessionId = "factory_test_2";
      
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      expect(manager).toBeDefined();
      
      SessionLifecycleManagerFactory.removeSessionLifecycleManager(sessionId);
      
      const allManagers = SessionLifecycleManagerFactory.getAllSessionLifecycleManagers();
      expect(allManagers.has(sessionId)).toBe(false);
    });

    test("should get session lifecycle statistics", () => {
      const session1 = SessionLifecycleManagerFactory.getSessionLifecycleManager("stats_test_1");
      const session2 = SessionLifecycleManagerFactory.getSessionLifecycleManager("stats_test_2");
      
      session1.initialize(mockServer, testServerInfo);
      session2.initialize(mockServer, testServerInfo);
      
      const stats = SessionLifecycleManagerFactory.getSessionLifecycleStats();
      
      expect(stats.total).toBe(2);
      expect(stats.initializing).toBe(2);
      expect(stats.operational).toBe(0);
      expect(stats.shutdown).toBe(0);
    });

    test("should cleanup inactive sessions", async () => {
      const session1 = SessionLifecycleManagerFactory.getSessionLifecycleManager("cleanup_test_1");
      const session2 = SessionLifecycleManagerFactory.getSessionLifecycleManager("cleanup_test_2");
      
      session1.initialize(mockServer, testServerInfo);
      session2.initialize(mockServer, testServerInfo);
      
      // Wait a bit to ensure sessions are considered inactive
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Force cleanup with very short max inactive time
      const cleanedCount = SessionLifecycleManagerFactory.cleanupInactiveSessions(1);
      
      expect(cleanedCount).toBe(2);
      
      const remainingManagers = SessionLifecycleManagerFactory.getAllSessionLifecycleManagers();
      expect(remainingManagers.size).toBe(0);
    });
  });

  describe("Session Status and Information", () => {
    test("should get session-specific status", () => {
      const sessionId = "status_test_1";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      manager.initialize(mockServer, testServerInfo);
      
      const request = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: { tools: { listChanged: true } },
          clientInfo: { name: "status-client", version: "1.0.0" },
        },
      };
      
      manager.handleInitializeRequest(request);
      
      const status = manager.getSessionStatus();
      
      expect(status.sessionId).toBe(sessionId);
      expect(status.state).toBe(LifecycleState.INITIALIZED);
      expect(status.protocolVersion).toBe(APP_CONFIG.protocol);
      expect(status.clientInfo).toEqual(request.params.clientInfo);
      expect(status.serverInfo).toEqual(testServerInfo);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });

    test("should track session uptime correctly", async () => {
      const sessionId = "uptime_test_1";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      const startTime = Date.now();
      manager.initialize(mockServer, testServerInfo);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const uptime = manager.getUptime();
      const elapsed = Date.now() - startTime;
      
      expect(uptime).toBeGreaterThan(0);
      expect(uptime).toBeLessThanOrEqual(elapsed);
    });

    test("should check operational status correctly", () => {
      const sessionId = "operational_test_1";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      // Initially not operational
      expect(manager.isOperational()).toBe(false);
      
      manager.initialize(mockServer, testServerInfo);
      
      // Still not operational after initialization
      expect(manager.isOperational()).toBe(false);
      
      const request = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      };
      
      manager.handleInitializeRequest(request);
      
      // Now should be operational (INITIALIZED state)
      expect(manager.isOperational()).toBe(false); // Still false because not OPERATING
      
      // Mark as operating
      (manager as any).state = LifecycleState.OPERATING;
      expect(manager.isOperational()).toBe(true);
    });
  });

  describe("Error Handling", () => {
    test("should handle shutdown during initialization", async () => {
      const sessionId = "error_test_1";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      manager.initialize(mockServer, testServerInfo);
      
      // Start shutdown immediately
      const shutdownPromise = manager.shutdown("Immediate shutdown");
      
      // State should be shutting down or already shutdown
      const state = manager.getState();
      expect(state === LifecycleState.SHUTTING_DOWN || state === LifecycleState.SHUTDOWN).toBe(true);
      
      await shutdownPromise;
      
      expect(manager.getState()).toBe(LifecycleState.SHUTDOWN);
    });

    test("should handle multiple shutdown calls gracefully", async () => {
      const sessionId = "error_test_2";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      manager.initialize(mockServer, testServerInfo);
      
      const request = {
        params: {
          protocolVersion: APP_CONFIG.protocol,
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      };
      
      manager.handleInitializeRequest(request);
      
      // Call shutdown multiple times
      const shutdown1 = manager.shutdown("First shutdown");
      const shutdown2 = manager.shutdown("Second shutdown");
      
      await Promise.all([shutdown1, shutdown2]);
      
      expect(manager.getState()).toBe(LifecycleState.SHUTDOWN);
    });

    test("should handle shutdown handler errors gracefully", async () => {
      const sessionId = "error_test_3";
      const manager = SessionLifecycleManagerFactory.getSessionLifecycleManager(sessionId);
      
      manager.onShutdown(() => {
        throw new Error("Shutdown handler error");
      });
      
      manager.initialize(mockServer, testServerInfo);
      
      // Should not throw error
      await expect(manager.shutdown("Test shutdown")).resolves.toBeUndefined();
      
      expect(manager.getState()).toBe(LifecycleState.SHUTDOWN);
    });
  });
}); 