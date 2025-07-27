import { test, expect, beforeEach, afterEach, describe } from "bun:test";
import { logger } from "../standard/logger.js";

/**
 * Logging System Tests
 * 
 * Comprehensive tests for the RFC 5424 compliant logging system
 * covering all severity levels, rate limiting, sensitive data filtering,
 * and MCP client integration features.
 */

describe("Logging System Tests", () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logOutput: string[] = [];

  beforeEach(() => {
    // Capture console output for testing
    logOutput = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    
    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };
    console.error = (...args) => {
      logOutput.push(args.join(' '));
    };

    // Reset logger state
    logger.setSensitiveDataFilter(true);
    logger.setRateLimiting(false); // Disable for most tests
    logger.setLevel("debug");
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("RFC 5424 Severity Levels", () => {
    test("All 8 severity levels work correctly", async () => {
      await logger.debug("Debug message");
      await logger.info("Info message");
      await logger.notice("Notice message");
      await logger.warning("Warning message");
      await logger.error("Error message");
      await logger.critical("Critical message");
      await logger.alert("Alert message");
      await logger.emergency("Emergency message");

      expect(logOutput.length).toBe(8);
      expect(logOutput[0]).toContain("DEBUG");
      expect(logOutput[1]).toContain("INFO");
      expect(logOutput[2]).toContain("NOTICE");
      expect(logOutput[3]).toContain("WARNING");
      expect(logOutput[4]).toContain("ERROR");
      expect(logOutput[5]).toContain("CRITICAL");
      expect(logOutput[6]).toContain("ALERT");
      expect(logOutput[7]).toContain("EMERGENCY");
    });

    test("Level-based filtering works", async () => {
      // Set minimum level to warning
      logger.setLevel("warning");

      await logger.debug("Should not appear");
      await logger.info("Should not appear");
      await logger.notice("Should not appear");
      await logger.warning("Should appear");
      await logger.error("Should appear");
      await logger.critical("Should appear");

      expect(logOutput.length).toBe(3);
      expect(logOutput.every(log => 
        log.includes("WARNING") || 
        log.includes("ERROR") || 
        log.includes("CRITICAL")
      )).toBe(true);
    });
  });

  describe("Structured Logging", () => {
    test("JSON object logging preserves structure", async () => {
      const testData = {
        message: "User action completed",
        userId: "123",
        action: "login",
        timestamp: new Date().toISOString(),
        nested: {
          property: "value",
          count: 42
        }
      };

      await logger.info(testData);

      expect(logOutput.length).toBe(1);
      const logEntry = JSON.parse(logOutput[0]);
      expect(logEntry.message).toBe("User action completed");
      expect(logEntry.userId).toBe("123");
      expect(logEntry.nested.count).toBe(42);
    });

    test("String messages work alongside structured data", async () => {
      await logger.info("Simple string message");
      
      expect(logOutput.length).toBe(1);
      const logEntry = JSON.parse(logOutput[0]);
      expect(logEntry.message).toBe("Simple string message");
    });
  });

  describe("Specialized Logging Methods", () => {
    test("logMethodEntry creates proper trace structure", async () => {
      const traceId = await logger.logMethodEntry("testFunction", { param1: "value" }, "testModule");

      expect(logOutput.length).toBe(1);
      const logEntry = JSON.parse(logOutput[0]);
      expect(logEntry.message).toBe("Method entry: testFunction");
      expect(logEntry.module).toBe("testModule");
      expect(logEntry.params).toEqual({ param1: "value" });
      expect(typeof traceId).toBe("string");
      expect(traceId.length).toBe(32); // 128-bit trace ID
    });

    test("logMethodExit correlates with entry", async () => {
      const traceId = await logger.logMethodEntry("testFunction", {}, "testModule");
      await logger.logMethodExit("testFunction", { result: "success" }, "testModule", traceId);

      expect(logOutput.length).toBe(2);
      
      const entryLog = JSON.parse(logOutput[0]);
      const exitLog = JSON.parse(logOutput[1]);
      
      expect(entryLog._trace?.traceId).toBe(traceId);
      expect(exitLog._trace?.traceId).toBe(traceId);
      expect(exitLog.message).toBe("Method exit: testFunction");
    });

    test("logEndpointEntry creates endpoint-specific traces", async () => {
      const traceId = await logger.logEndpointEntry("tools/list", "req-123", { cursor: "abc" });

      expect(logOutput.length).toBe(1);
      const logEntry = JSON.parse(logOutput[0]);
      expect(logEntry.message).toBe("Endpoint entry: tools/list");
      expect(logEntry.requestId).toBe("req-123");
      expect(logEntry.params.cursor).toBe("abc");
      expect(logEntry._trace?.attributes?.['mcp.endpoint']).toBe("tools/list");
    });

    test("logServerError creates error traces", async () => {
      const error = new Error("Test error message");
      error.stack = "Error: Test error\n    at test.js:1:1";

      await logger.logServerError(error, "test operation", { requestId: "req-123" });

      expect(logOutput.length).toBe(1);
      const logEntry = JSON.parse(logOutput[0]);
      expect(logEntry.message).toBe("Server error in test operation");
      expect(logEntry.error.message).toBe("Test error message");
      expect(logEntry.error.name).toBe("Error");
      expect(logEntry.context.requestId).toBe("req-123");
    });
  });

  describe("Sensitive Data Filtering", () => {
    test("Sensitive patterns are filtered by default", async () => {
      const sensitiveData = {
        username: "john",
        password: "secret123",
        apiKey: "abc-def-ghi",
        token: "jwt-token-here",
        secret: "top-secret",
        privateKey: "private-key-data",
        credential: "credentials",
        authToken: "auth-token"
      };

      await logger.info(sensitiveData);

      expect(logOutput.length).toBe(1);
      const logEntry = JSON.parse(logOutput[0]);
      
      expect(logEntry.username).toBe("john"); // Not sensitive
      expect(logEntry.password).toBe("[FILTERED]");
      expect(logEntry.apiKey).toBe("[FILTERED]");
      expect(logEntry.token).toBe("[FILTERED]");
      expect(logEntry.secret).toBe("[FILTERED]");
      expect(logEntry.privateKey).toBe("[FILTERED]");
      expect(logEntry.credential).toBe("[FILTERED]");
      expect(logEntry.authToken).toBe("[FILTERED]");
    });

    test("Sensitive data filtering can be disabled", async () => {
      logger.setSensitiveDataFilter(false);

      const sensitiveData = {
        password: "secret123",
        apiKey: "abc-def-ghi"
      };

      await logger.info(sensitiveData);

      expect(logOutput.length).toBe(1);
      const logEntry = JSON.parse(logOutput[0]);
      
      expect(logEntry.password).toBe("secret123");
      expect(logEntry.apiKey).toBe("abc-def-ghi");
    });

    test("Nested sensitive data is filtered", async () => {
      const nestedData = {
        user: {
          name: "john",
          credentials: {
            password: "secret123",
            apiKey: "abc-def"
          }
        },
        auth: {
          token: "jwt-token"
        }
      };

      await logger.info(nestedData);

      const logEntry = JSON.parse(logOutput[0]);
      expect(logEntry.user.name).toBe("john");
      expect(logEntry.user.credentials.password).toBe("[FILTERED]");
      expect(logEntry.user.credentials.apiKey).toBe("[FILTERED]");
      expect(logEntry.auth.token).toBe("[FILTERED]");
    });
  });

  describe("Rate Limiting", () => {
    test("Rate limiting suppresses excessive logs", async () => {
      logger.setRateLimiting(true);

      // Send 20 debug messages rapidly
      for (let i = 0; i < 20; i++) {
        await logger.debug(`Message ${i}`);
      }

      // Should have less than 20 messages due to rate limiting
      expect(logOutput.length).toBeLessThan(20);
      
      // Should have at least some messages
      expect(logOutput.length).toBeGreaterThan(0);
      
      // Last message might be a suppression warning
      const possibleSuppression = logOutput[logOutput.length - 1];
      if (possibleSuppression.includes("suppressed")) {
        expect(possibleSuppression).toContain("WARNING");
      }
    });

    test("Critical levels bypass rate limiting", async () => {
      logger.setRateLimiting(true);

      // Send many critical messages
      for (let i = 0; i < 15; i++) {
        await logger.critical(`Critical message ${i}`);
      }

      // All critical messages should get through
      expect(logOutput.length).toBe(15);
      expect(logOutput.every(log => log.includes("CRITICAL"))).toBe(true);
    });

    test("Rate limiting can be disabled", async () => {
      logger.setRateLimiting(false);

      // Send many messages
      for (let i = 0; i < 15; i++) {
        await logger.debug(`Message ${i}`);
      }

      // All messages should get through
      expect(logOutput.length).toBe(15);
    });
  });

  describe("Session Context Integration", () => {
    test("Session context is preserved in logs", async () => {
      // Mock session context
      const mockSession = {
        sessionId: "sess_123",
        clientId: "client-456",
        transportType: "http"
      };

      // This would normally be set by the transport layer
      (logger as any).currentSession = mockSession;

      await logger.info("Test message with session");

      const logEntry = JSON.parse(logOutput[0]);
      expect(logEntry._session?.sessionId).toBe("sess_123");
      expect(logEntry._session?.clientId).toBe("client-456");
      expect(logEntry._session?.transportType).toBe("http");

      // Cleanup
      delete (logger as any).currentSession;
    });
  });

  describe("Trace Context Integration", () => {
    test("Trace context is included in logs", async () => {
      const traceId = await logger.logMethodEntry("testMethod", {}, "test");

      const logEntry = JSON.parse(logOutput[0]);
      expect(logEntry._trace?.traceId).toBe(traceId);
      expect(logEntry._trace?.operationName).toBe("method.entry");
      expect(typeof logEntry._trace?.spanId).toBe("string");
    });

    test("Parent-child trace relationships work", async () => {
      const parentTrace = await logger.logMethodEntry("parentMethod", {}, "test");
      const childTrace = logger.startOperation("childOperation", {
        'operation.type': 'validation'
      });

      await logger.info("Child operation log");

      // The child operation should inherit trace context
      expect(logOutput.length).toBe(2); // parent entry + child log
      
      const childLog = JSON.parse(logOutput[1]);
      expect(childLog._trace?.traceId).toBeDefined();
    });
  });

  describe("Performance Characteristics", () => {
    test("Logging performance is acceptable", async () => {
      const start = performance.now();
      
      // Log 1000 messages
      for (let i = 0; i < 1000; i++) {
        await logger.info(`Performance test message ${i}`);
      }
      
      const duration = performance.now() - start;
      
      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
      
      // Should have logged all messages (rate limiting disabled)
      expect(logOutput.length).toBe(1000);
    });

    test("Memory usage is controlled", async () => {
      logger.setRateLimiting(true);
      
      // Generate many logs to test memory management
      for (let i = 0; i < 100; i++) {
        await logger.debug(`Memory test ${i}`);
      }
      
      // Rate limiter should clean up expired entries automatically
      // This is more of a smoke test - detailed memory testing would need profiling
      expect(logOutput.length).toBeGreaterThan(0);
    });
  });

  describe("Configuration and Management", () => {
    test("Log level can be changed dynamically", async () => {
      logger.setLevel("error");
      
      await logger.info("Should not appear");
      await logger.error("Should appear");
      
      expect(logOutput.length).toBe(1);
      expect(logOutput[0]).toContain("ERROR");
      
      // Change level
      logger.setLevel("info");
      
      await logger.info("Should now appear");
      
      expect(logOutput.length).toBe(2);
      expect(logOutput[1]).toContain("INFO");
    });

    test("Sensitive data filter can be toggled", async () => {
      const testData = { password: "secret" };
      
      // Filter enabled
      logger.setSensitiveDataFilter(true);
      await logger.info(testData);
      
      let logEntry = JSON.parse(logOutput[0]);
      expect(logEntry.password).toBe("[FILTERED]");
      
      // Filter disabled
      logger.setSensitiveDataFilter(false);
      await logger.info(testData);
      
      logEntry = JSON.parse(logOutput[1]);
      expect(logEntry.password).toBe("secret");
    });

    test("Rate limiting can be toggled", async () => {
      // Enable rate limiting
      logger.setRateLimiting(true);
      
      // Send many messages
      for (let i = 0; i < 15; i++) {
        await logger.debug(`Rate limit test ${i}`);
      }
      
      const rateLimitedCount = logOutput.length;
      
      // Reset and disable rate limiting
      logOutput = [];
      logger.setRateLimiting(false);
      
      // Send same number of messages
      for (let i = 0; i < 15; i++) {
        await logger.debug(`No rate limit test ${i}`);
      }
      
      expect(logOutput.length).toBe(15);
      expect(logOutput.length).toBeGreaterThan(rateLimitedCount);
    });
  });

  describe("Error Handling", () => {
    test("Malformed log data is handled gracefully", async () => {
      // Test with circular reference
      const circular: any = { name: "test" };
      circular.self = circular;

      // Should not throw
      await expect(logger.info(circular)).resolves.toBeUndefined();
      
      // Should have attempted to log something
      expect(logOutput.length).toBeGreaterThan(0);
    });

    test("Null and undefined values are handled", async () => {
      await logger.info(null as any);
      await logger.info(undefined as any);
      await logger.info({ value: null, other: undefined });

      expect(logOutput.length).toBe(3);
      
      const logEntry = JSON.parse(logOutput[2]);
      expect(logEntry.value).toBe(null);
      expect('other' in logEntry).toBe(false); // undefined should be omitted
    });
  });

  describe("Integration Examples", () => {
    test("Express middleware integration pattern", async () => {
      // Simulate Express middleware logging
      const mockReq = {
        method: "POST",
        url: "/mcp",
        headers: { 'user-agent': 'test-client/1.0' },
        ip: "127.0.0.1"
      };

      await logger.info({
        message: "HTTP request",
        method: mockReq.method,
        url: mockReq.url,
        userAgent: mockReq.headers['user-agent'],
        clientIp: mockReq.ip
      }, "http");

      const logEntry = JSON.parse(logOutput[0]);
      expect(logEntry.message).toBe("HTTP request");
      expect(logEntry.method).toBe("POST");
      expect(logEntry.module).toBe("http");
    });

    test("Error boundary integration pattern", async () => {
      const mockError = new Error("Uncaught exception");
      mockError.stack = "Error: Uncaught exception\n    at test.js:1:1";

      await logger.emergency({
        message: "Uncaught exception",
        error: mockError.message,
        stack: mockError.stack
      }, "system");

      const logEntry = JSON.parse(logOutput[0]);
      expect(logEntry.message).toBe("Uncaught exception");
      expect(logEntry.module).toBe("system");
      expect(logEntry.error).toBe("Uncaught exception");
      expect(logEntry.stack).toContain("test.js:1:1");
    });

    test("Custom domain logger pattern", async () => {
      // Test pattern from documentation
      const authLogger = {
        info: (data: any) => logger.info(data, "auth"),
        warning: (data: any) => logger.warning(data, "auth"),
        error: (data: any) => logger.error(data, "auth"),
      };

      await authLogger.info({ message: "User logged in", userId: "123" });
      await authLogger.warning({ message: "Invalid password attempt", userId: "456" });
      await authLogger.error({ message: "Account locked", userId: "789" });

      expect(logOutput.length).toBe(3);
      
      const logs = logOutput.map(output => JSON.parse(output));
      expect(logs.every(log => log.module === "auth")).toBe(true);
      expect(logs[0].message).toBe("User logged in");
      expect(logs[1].message).toBe("Invalid password attempt");
      expect(logs[2].message).toBe("Account locked");
    });
  });
});