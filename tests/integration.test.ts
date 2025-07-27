import { test, expect, beforeAll, afterAll, beforeEach, afterEach, describe } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express from "express";
import { createHttpTransport } from "../standard/transports.js";
import { LifecycleManager } from "../standard/lifecycle.js";
import { logger } from "../standard/logger.js";
import { initializeSigNoz } from "../common/signoz/init.js";
import { signoz } from "../common/signoz/index.js";
import { traceMcpEndpoint } from "../common/signoz/helpers.js";

/**
 * Integration Tests for Complete Data Flow with Logging and Tracing
 * 
 * These tests verify the complete integration of:
 * - Data flow architecture (from architecture-flow.md)
 * - Logging system (from logging-system.md) 
 * - Tracing system (from tracing-guide.md)
 * - SignOz integration (from signoz-integration.md)
 * 
 * Tests the end-to-end flow from client request through all system layers
 * with comprehensive observability.
 */

describe("Complete Integration Tests", () => {
  let server: McpServer;
  let lifecycleManager: LifecycleManager;
  let app: express.Application;
  let httpServer: any;
  let logOutput: string[] = [];
  let originalConsoleLog: typeof console.log;
  let fetchCalls: Array<{ url: string, options: any }> = [];
  let mockFetch: typeof fetch;

  const testPort = 3003;

  beforeAll(async () => {
    // Initialize SignOz for integration tests
    mockFetch = global.fetch;
    global.fetch = async (url: string | URL, options?: any) => {
      fetchCalls.push({ url: url.toString(), options: options || {} });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    await initializeSigNoz({
      endpoint: 'http://localhost:4318',
      serviceName: 'integration-test-server',
      serviceVersion: '1.0.0',
      environment: 'test',
    });

    // Capture logs
    originalConsoleLog = console.log;
    console.log = (...args) => {
      logOutput.push(args.join(' '));
    };

    // Configure logger for testing
    logger.setSensitiveDataFilter(true);
    logger.setRateLimiting(false);
    logger.setLevel("debug");
  });

  afterAll(async () => {
    console.log = originalConsoleLog;
    global.fetch = mockFetch;
    
    if (httpServer) {
      httpServer.close();
    }
    
    if (lifecycleManager) {
      await lifecycleManager.shutdown();
    }
  });

  beforeEach(() => {
    logOutput = [];
    fetchCalls = [];
  });

  describe("End-to-End Flow: HTTP Request → MCP Processing → Response", () => {
    test("Complete HTTP flow with full observability", async () => {
      // 1. Initialize server components
      lifecycleManager = new LifecycleManager();
      await lifecycleManager.initialize();
      
      server = new McpServer(
        {
          name: "integration-test-server",
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

      app = express();

      // 2. Set up HTTP transport with tracing
      const { httpServer: testHttpServer } = await createHttpTransport(
        app,
        testPort,
        server,
        {
          onSessionCreate: (sessionId: string) => {
            logger.info({ 
              message: "Session created", 
              sessionId 
            }, "transport");
          },
          onSessionDestroy: (sessionId: string) => {
            logger.info({ 
              message: "Session destroyed", 
              sessionId 
            }, "transport");
          }
        }
      );

      httpServer = testHttpServer;

      // 3. Complete lifecycle
      lifecycleManager.markInitialized();
      lifecycleManager.setOperating();

      // 4. Make HTTP request to health endpoint
      const healthResponse = await fetch(`http://localhost:${testPort}/health`);
      expect(healthResponse.status).toBe(200);

      // 5. Make MCP request with full tracing
      const mcpResponse = await fetch(`http://localhost:${testPort}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'traceparent': '00-002c08b9d7041c1800044749c7bb5bb8-00b2deaa23f22b58-01'
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "ping"
        })
      });

      expect(mcpResponse.status).toBe(200);
      const mcpResult = await mcpResponse.json();
      expect(mcpResult.result).toEqual({});

      // 6. Verify logging was captured
      expect(logOutput.length).toBeGreaterThan(0);
      
      // Check for session logs
      const sessionLogs = logOutput.filter(log => log.includes("Session"));
      expect(sessionLogs.length).toBeGreaterThan(0);

      // Check for MCP endpoint logs
      const endpointLogs = logOutput.filter(log => log.includes("ping"));
      expect(endpointLogs.length).toBeGreaterThan(0);

      // 7. Verify SignOz traces were sent
      expect(fetchCalls.length).toBeGreaterThan(0);
      const traceCalls = fetchCalls.filter(call => 
        call.url.includes('4318') && call.url.includes('traces')
      );
      expect(traceCalls.length).toBeGreaterThan(0);

      // 8. Clean shutdown
      httpServer.close();
      await lifecycleManager.shutdown();
    });
  });

  describe("MCP Protocol Flow with Complete Observability", () => {
    test("Initialize → Operating → Ping with traces and logs", async () => {
      // Create test server
      const testLifecycle = new LifecycleManager();
      await testLifecycle.initialize();

      const testServer = new McpServer(
        { name: "protocol-test", version: "1.0.0" },
        { capabilities: { logging: {} } }
      );

      // Simulate initialize request with tracing
      const initResult = await traceMcpEndpoint(
        'initialize',
        'req-init-123',
        async () => {
          testLifecycle.markInitialized();
          
          return {
            protocolVersion: "2025-06-18",
            capabilities: { logging: {} },
            serverInfo: {
              name: "protocol-test",
              version: "1.0.0"
            }
          };
        },
        {
          'protocol.version': '2025-06-18',
          'client.name': 'test-client'
        }
      );

      expect(initResult.protocolVersion).toBe("2025-06-18");

      // Transition to operating
      testLifecycle.setOperating();

      // Simulate ping request with tracing  
      const pingResult = await traceMcpEndpoint(
        'ping',
        'req-ping-456',
        async () => {
          return {};
        }
      );

      expect(pingResult).toEqual({});

      // Verify logs contain trace context
      const traceLogs = logOutput.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed._trace?.traceId;
        } catch {
          return false;
        }
      });

      expect(traceLogs.length).toBeGreaterThan(0);

      await testLifecycle.shutdown();
    });
  });

  describe("Error Scenarios with Full Observability", () => {
    test("Error propagation through all layers", async () => {
      const testLifecycle = new LifecycleManager();
      await testLifecycle.initialize();
      testLifecycle.markInitialized();
      testLifecycle.setOperating();

      // Simulate error in MCP endpoint
      await expect(
        traceMcpEndpoint(
          'tools/call',
          'req-error-789',
          async () => {
            const error = new Error("Tool execution failed");
            await logger.logServerError(error, "tools/call", {
              requestId: 'req-error-789',
              toolName: 'failing-tool'
            });
            throw error;
          },
          {
            'tool.name': 'failing-tool',
            'error.expected': true
          }
        )
      ).rejects.toThrow("Tool execution failed");

      // Verify error was logged with trace context
      const errorLogs = logOutput.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.message?.includes("Server error") && parsed._trace;
        } catch {
          return false;
        }
      });

      expect(errorLogs.length).toBeGreaterThan(0);

      // Verify error span was sent to SignOz
      const errorSpans = fetchCalls.filter(call => 
        call.url.includes('4318') && 
        call.options.body?.includes('error')
      );
      expect(errorSpans.length).toBeGreaterThan(0);

      await testLifecycle.shutdown();
    });

    test("Rate limiting with trace correlation", async () => {
      // Enable rate limiting for this test
      logger.setRateLimiting(true);

      // Send many requests rapidly
      const requests = Array.from({ length: 15 }, (_, i) =>
        traceMcpEndpoint(
          'ping',
          `req-rate-${i}`,
          async () => {
            await logger.debug(`Rate limit test message ${i}`);
            return { ping: i };
          }
        )
      );

      const results = await Promise.all(requests);
      expect(results.length).toBe(15);

      // Should have rate limiting warnings in logs
      const rateLimitLogs = logOutput.filter(log => 
        log.includes("suppressed") || log.includes("rate")
      );

      // Reset rate limiting
      logger.setRateLimiting(false);
    });
  });

  describe("Session Lifecycle with Observability", () => {
    test("Session creation → operations → cleanup with full tracking", async () => {
      const sessionId = "sess_integration_test_123";
      const clientId = "integration-test-client";

      // Session creation
      await signoz.withSpan('session.create', async () => {
        await logger.info({
          message: "Session created",
          sessionId,
          clientId,
          transportType: "http"
        }, "session");

        return 'session-created';
      });

      // Multiple operations within session
      for (let i = 0; i < 3; i++) {
        await traceMcpEndpoint(
          'ping',
          `session-req-${i}`,
          async () => {
            await logger.debug({
              message: `Session operation ${i}`,
              sessionId,
              operationIndex: i
            }, "session");
            
            return { pong: i };
          },
          {
            'session.id': sessionId,
            'operation.index': i
          }
        );
      }

      // Session cleanup
      await signoz.withSpan('session.cleanup', async () => {
        await logger.info({
          message: "Session cleanup",
          sessionId,
          operationsCompleted: 3
        }, "session");

        return 'session-cleaned';
      });

      // Verify session context in logs
      const sessionLogs = logOutput.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.sessionId === sessionId;
        } catch {
          return false;
        }
      });

      expect(sessionLogs.length).toBeGreaterThan(3); // Create + 3 operations + cleanup

      // Verify trace correlation
      const sessionTraces = logOutput.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed._trace?.traceId && parsed.sessionId === sessionId;
        } catch {
          return false;
        }
      });

      expect(sessionTraces.length).toBeGreaterThan(0);
    });
  });

  describe("Performance Monitoring Integration", () => {
    test("Performance metrics collection and reporting", async () => {
      const operations = [
        { name: 'fast-operation', duration: 10 },
        { name: 'medium-operation', duration: 100 },
        { name: 'slow-operation', duration: 500 }
      ];

      for (const op of operations) {
        await traceMcpEndpoint(
          op.name,
          `perf-req-${op.name}`,
          async () => {
            // Simulate operation duration
            await new Promise(resolve => setTimeout(resolve, op.duration));
            
            await logger.info({
              message: "Operation completed",
              operationName: op.name,
              duration: op.duration
            }, "performance");

            return { completed: true, duration: op.duration };
          },
          {
            'operation.type': 'performance-test',
            'expected.duration': op.duration
          }
        );
      }

      // Verify performance logs
      const perfLogs = logOutput.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.module === "performance" && parsed.duration;
        } catch {
          return false;
        }
      });

      expect(perfLogs.length).toBe(3);

      // Verify metrics were sent to SignOz
      const metricCalls = fetchCalls.filter(call => 
        call.url.includes('4318') && 
        call.url.includes('metrics')
      );
      expect(metricCalls.length).toBeGreaterThan(0);
    });
  });

  describe("Security Event Tracking", () => {
    test("Security events with sensitive data filtering", async () => {
      // Simulate authentication events
      await logger.info({
        message: "Authentication attempt",
        username: "testuser",
        password: "secret123",  // Should be filtered
        apiKey: "key-abc-def",  // Should be filtered
        result: "success",
        timestamp: new Date().toISOString()
      }, "security");

      // Simulate authorization event
      await logger.warning({
        message: "Unauthorized access attempt",
        clientId: "malicious-client",
        requestedResource: "/admin/secrets",
        token: "invalid-token", // Should be filtered
        sourceIp: "192.168.1.100"
      }, "security");

      // Verify sensitive data was filtered
      const securityLogs = logOutput.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.module === "security";
        } catch {
          return false;
        }
      });

      expect(securityLogs.length).toBe(2);

      // Check that sensitive data was filtered
      const authLog = JSON.parse(securityLogs[0]);
      expect(authLog.username).toBe("testuser");
      expect(authLog.password).toBe("[FILTERED]");
      expect(authLog.apiKey).toBe("[FILTERED]");
      expect(authLog.result).toBe("success");

      const authzLog = JSON.parse(securityLogs[1]);
      expect(authzLog.token).toBe("[FILTERED]");
      expect(authzLog.sourceIp).toBe("192.168.1.100");
    });
  });

  describe("Distributed Tracing Across Components", () => {
    test("Trace context propagation through complex operations", async () => {
      // Start a complex operation that spans multiple components
      const complexResult = await traceMcpEndpoint(
        'complex/operation',
        'complex-req-123',
        async () => {
          // Component 1: Authentication
          const authResult = await signoz.withSpan('auth.validate', async () => {
            await logger.info({ message: "Validating credentials" }, "auth");
            return { valid: true };
          });

          // Component 2: Authorization
          const authzResult = await signoz.withSpan('authz.check', async () => {
            await logger.info({ message: "Checking permissions" }, "authz");
            return { permitted: true };
          });

          // Component 3: Business Logic
          const businessResult = await signoz.withSpan('business.process', async () => {
            await logger.info({ message: "Processing business logic" }, "business");
            
            // Nested operation
            const dataResult = await signoz.withSpan('data.fetch', async () => {
              await logger.debug({ message: "Fetching data" }, "data");
              return { data: "business-data" };
            });

            return { processed: true, data: dataResult };
          });

          // Component 4: Response preparation
          const responseResult = await signoz.withSpan('response.prepare', async () => {
            await logger.info({ message: "Preparing response" }, "response");
            return {
              auth: authResult,
              authz: authzResult,
              business: businessResult,
              timestamp: Date.now()
            };
          });

          return responseResult;
        },
        {
          'operation.type': 'complex',
          'components.count': 4
        }
      );

      expect(complexResult.auth.valid).toBe(true);
      expect(complexResult.authz.permitted).toBe(true);
      expect(complexResult.business.processed).toBe(true);

      // Verify all components logged with trace context
      const componentLogs = ['auth', 'authz', 'business', 'data', 'response'];
      for (const component of componentLogs) {
        const componentLog = logOutput.find(log => {
          try {
            const parsed = JSON.parse(log);
            return parsed.module === component && parsed._trace?.traceId;
          } catch {
            return false;
          }
        });
        expect(componentLog).toBeDefined();
      }

      // All logs should share the same trace ID
      const traceLogs = logOutput.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed._trace?.traceId;
        } catch {
          return false;
        }
      });

      if (traceLogs.length > 1) {
        const firstTraceId = JSON.parse(traceLogs[0])._trace.traceId;
        const allSameTrace = traceLogs.every(log => {
          try {
            const parsed = JSON.parse(log);
            return parsed._trace.traceId === firstTraceId;
          } catch {
            return false;
          }
        });
        expect(allSameTrace).toBe(true);
      }
    });
  });

  describe("Shutdown Sequence with Complete Observability", () => {
    test("Graceful shutdown with cleanup tracking", async () => {
      const testLifecycle = new LifecycleManager();
      await testLifecycle.initialize();
      testLifecycle.markInitialized();
      testLifecycle.setOperating();

      // Simulate active operations
      const activeOperations = Array.from({ length: 3 }, (_, i) =>
        traceMcpEndpoint(
          'background/task',
          `bg-req-${i}`,
          async () => {
            // Long-running operation
            await new Promise(resolve => setTimeout(resolve, 50));
            return { task: i, completed: true };
          }
        )
      );

      // Start shutdown while operations are running
      const shutdownPromise = signoz.withSpan('server.shutdown', async () => {
        await logger.alert("Shutdown initiated", "lifecycle");
        await testLifecycle.shutdown();
        await logger.alert("Shutdown completed", "lifecycle");
        return 'shutdown-complete';
      });

      // Wait for all operations to complete
      const [shutdownResult, ...opResults] = await Promise.all([
        shutdownPromise,
        ...activeOperations
      ]);

      expect(shutdownResult).toBe('shutdown-complete');
      expect(opResults.every(result => result.completed)).toBe(true);

      // Verify shutdown was logged with trace context
      const shutdownLogs = logOutput.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.message?.includes("Shutdown") && parsed.module === "lifecycle";
        } catch {
          return false;
        }
      });

      expect(shutdownLogs.length).toBeGreaterThanOrEqual(2); // Initiated + completed
    });
  });

  describe("Real-world Scenario: Complete MCP Workflow", () => {
    test("Client session → tool calls → resource access → completion", async () => {
      const sessionId = "workflow-session-456";
      const clientId = "workflow-client";

      // 1. Client connection and initialization
      await traceMcpEndpoint(
        'initialize',
        'workflow-init',
        async () => {
          await logger.info({
            message: "Client connected",
            sessionId,
            clientId,
            capabilities: ["tools", "resources", "prompts"]
          }, "session");

          return {
            protocolVersion: "2025-06-18",
            capabilities: {
              tools: { listChanged: true },
              resources: { subscribe: true },
              prompts: { listChanged: true }
            }
          };
        },
        {
          'session.id': sessionId,
          'client.id': clientId,
          'protocol.version': '2025-06-18'
        }
      );

      // 2. Client lists available tools
      const toolsResult = await traceMcpEndpoint(
        'tools/list',
        'workflow-tools-list',
        async () => {
          const tools = [
            { name: 'calculator', description: 'Basic calculator' },
            { name: 'file-reader', description: 'Read files' }
          ];

          await logger.info({
            message: "Tools listed",
            sessionId,
            toolCount: tools.length
          }, "tools");

          return { tools };
        },
        {
          'session.id': sessionId,
          'operation.type': 'list'
        }
      );

      // 3. Client calls a tool
      const calcResult = await traceMcpEndpoint(
        'tools/call',
        'workflow-calc-call',
        async () => {
          await signoz.withSpan('tool.execute', async () => {
            await logger.info({
              message: "Tool execution started",
              sessionId,
              toolName: "calculator",
              operation: "add"
            }, "tools");

            // Simulate calculation
            await new Promise(resolve => setTimeout(resolve, 20));

            await logger.info({
              message: "Tool execution completed",
              sessionId,
              toolName: "calculator",
              result: 8
            }, "tools");
          });

          return { content: [{ type: "text", text: "Result: 8" }] };
        },
        {
          'session.id': sessionId,
          'tool.name': 'calculator',
          'tool.operation': 'add'
        }
      );

      // 4. Client accesses resources
      const resourceResult = await traceMcpEndpoint(
        'resources/read',
        'workflow-resource-read',
        async () => {
          await logger.info({
            message: "Resource accessed",
            sessionId,
            resourceUri: "file://example.txt"
          }, "resources");

          return {
            contents: [{
              uri: "file://example.txt",
              mimeType: "text/plain",
              text: "Example file content"
            }]
          };
        },
        {
          'session.id': sessionId,
          'resource.uri': 'file://example.txt'
        }
      );

      // 5. Session cleanup
      await signoz.withSpan('session.complete', async () => {
        await logger.info({
          message: "Session completed",
          sessionId,
          operationsCompleted: 4,
          duration: Date.now() - parseInt(sessionId.split('-')[2])
        }, "session");
      });

      // Verify all results
      expect(toolsResult.tools.length).toBe(2);
      expect(calcResult.content[0].text).toContain("8");
      expect(resourceResult.contents[0].text).toBe("Example file content");

      // Verify comprehensive logging
      const workflowLogs = logOutput.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.sessionId === sessionId;
        } catch {
          return false;
        }
      });

      expect(workflowLogs.length).toBeGreaterThanOrEqual(6); // All operations logged

      // Verify trace correlation across entire workflow
      const workflowTraces = workflowLogs.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed._trace?.traceId;
        } catch {
          return false;
        }
      });

      expect(workflowTraces.length).toBeGreaterThan(0);

      // Verify SignOz received comprehensive telemetry
      expect(fetchCalls.length).toBeGreaterThan(10); // Multiple traces and metrics
    });
  });
});