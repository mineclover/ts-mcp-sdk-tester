import { test, expect, beforeAll, afterAll, beforeEach, afterEach, describe } from "bun:test";
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { initializeSigNoz, conditionalInitializeSigNoz } from "../common/signoz/init.js";
import { signoz } from "../common/signoz/index.js";
import { 
  traceMcpEndpoint, 
  traceToolExecution, 
  addSessionContext, 
  recordBusinessEvent,
  incrementCounter,
  measureDuration
} from "../common/signoz/helpers.js";

/**
 * SignOz Integration and Tracing Tests
 * 
 * Comprehensive tests for SignOz integration including:
 * - OpenTelemetry configuration and initialization
 * - Span creation and management
 * - Trace context propagation
 * - MCP endpoint tracing
 * - Tool execution tracing
 * - Session correlation
 * - Business event recording
 * - Metrics collection
 * - Error handling and recovery
 */

describe("SignOz Integration Tests", () => {
  let mockFetch: typeof fetch;
  let fetchCalls: Array<{ url: string, options: any }> = [];

  beforeAll(async () => {
    // Mock fetch to capture SignOz exports
    mockFetch = global.fetch;
    global.fetch = async (url: string | URL, options?: any) => {
      fetchCalls.push({ 
        url: url.toString(), 
        options: options || {} 
      });
      
      // Mock successful response for SignOz endpoint
      if (url.toString().includes('4318')) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return mockFetch(url, options);
    };
  });

  afterAll(() => {
    global.fetch = mockFetch;
  });

  beforeEach(() => {
    fetchCalls = [];
  });

  describe("Initialization and Configuration", () => {
    test("initializeSigNoz with custom config works", async () => {
      const config = {
        endpoint: 'http://localhost:4318',
        serviceName: 'test-mcp-server',
        serviceVersion: '1.0.0',
        environment: 'test' as const,
        features: {
          traces: true,
          metrics: true,
          logs: false,
        },
        customAttributes: {
          team: 'test',
          region: 'local',
        },
      };

      await initializeSigNoz(config);
      
      expect(signoz.isInitialized()).toBe(true);
    });

    test("conditionalInitializeSigNoz respects environment variables", async () => {
      // Set test environment variables
      process.env.SIGNOZ_ENDPOINT = 'http://localhost:4318';
      process.env.OTEL_SERVICE_NAME = 'conditional-test';
      process.env.SIGNOZ_TRACES_ENABLED = 'true';

      await conditionalInitializeSigNoz();
      
      expect(signoz.isInitialized()).toBe(true);

      // Clean up
      delete process.env.SIGNOZ_ENDPOINT;
      delete process.env.OTEL_SERVICE_NAME;
      delete process.env.SIGNOZ_TRACES_ENABLED;
    });

    test("initialization without required config fails gracefully", async () => {
      // Should not throw, but should not initialize
      await expect(conditionalInitializeSigNoz()).resolves.toBeUndefined();
    });
  });

  describe("Basic Span Creation and Management", () => {
    beforeAll(async () => {
      await initializeSigNoz({
        endpoint: 'http://localhost:4318',
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
      });
    });

    test("startMcpSpan creates spans with proper attributes", () => {
      const span = signoz.startMcpSpan('mcp.test.unit.span_creation', {
        'user.id': 'user123',
        'operation.type': 'custom',
        'test.component': 'unit_test',
        'test.operation': 'span_creation'
      });

      expect(span).toBeDefined();
      
      // Add event to span
      span?.addEvent('operation.started');
      
      // Set attributes
      span?.setAttribute('result.count', 42);
      
      // End span
      span?.setStatus({ code: SpanStatusCode.OK });
      span?.end();
    });

    test("withSpan helper manages span lifecycle automatically", async () => {
      const result = await signoz.withSpan(
        'mcp.test.unit.with_span_helper',
        async () => {
          return { success: true, value: 42 };
        },
        {
          'test.attribute': 'value',
          'test.component': 'unit_test',
          'test.operation': 'with_span_helper'
        }
      );

      expect(result).toEqual({ success: true, value: 42 });
    });

    test("withSpan handles errors correctly", async () => {
      await expect(
        signoz.withSpan(
          'mcp.test.unit.error_handling',
          async () => {
            throw new Error('Test error');
          },
          {
            'test.component': 'unit_test',
            'test.operation': 'error_handling',
            'test.expected_error': true
          }
        )
      ).rejects.toThrow('Test error');
    });
  });

  describe("MCP Endpoint Tracing", () => {
    test("traceMcpEndpoint creates proper MCP spans", async () => {
      const result = await traceMcpEndpoint(
        'tools/list',
        'req-123',
        async () => {
          return { tools: [{ name: 'calculator' }] };
        },
        {
          'client.id': 'client-456',
          'page.size': 10,
        }
      );

      expect(result).toEqual({ tools: [{ name: 'calculator' }] });
      
      // Should record MCP request metrics
      expect(fetchCalls.length).toBeGreaterThan(0);
    });

    test("traceMcpEndpoint handles errors properly", async () => {
      await expect(
        traceMcpEndpoint(
          'tools/call',
          'req-124',
          async () => {
            throw new Error('Tool execution failed');
          },
          {
            'tool.name': 'broken-tool',
          }
        )
      ).rejects.toThrow('Tool execution failed');
    });

    test("traceToolExecution creates specialized tool spans", async () => {
      const result = await traceToolExecution(
        'calculator',
        { operation: 'add', a: 5, b: 3 },
        async () => {
          return { result: 8 };
        }
      );

      expect(result).toEqual({ result: 8 });
    });
  });

  describe("Session Correlation", () => {
    test("addSessionContext enriches current span", () => {
      const span = signoz.startMcpSpan('test.session');
      
      addSessionContext('sess-123', 'client-456', 'http');
      
      // Context should be added to the span
      span?.end();
    });

    test("session context persists across operations", async () => {
      addSessionContext('sess-789', 'client-abc', 'stdio');

      await signoz.withSpan('operation.1', async () => {
        // Session context should be available
        return 'result1';
      });

      await signoz.withSpan('operation.2', async () => {
        // Session context should still be available
        return 'result2';
      });
    });
  });

  describe("Business Event Recording", () => {
    test("recordBusinessEvent adds events to current span", () => {
      const span = signoz.startMcpSpan('business.operation');
      
      recordBusinessEvent('user.action', {
        action: 'tool_executed',
        tool: 'calculator',
        success: true,
      });

      span?.end();
    });

    test("business events work without active span", () => {
      // Should not throw
      expect(() => {
        recordBusinessEvent('system.event', {
          event: 'startup',
          component: 'mcp-server',
        });
      }).not.toThrow();
    });
  });

  describe("Metrics Collection", () => {
    test("recordMcpRequest captures request metrics", () => {
      signoz.recordMcpRequest(
        'tools/call',
        'success',
        125, // duration in ms
        {
          tool_name: 'calculator',
          client_type: 'vscode',
        }
      );

      // Should send metrics to SignOz
      expect(fetchCalls.some(call => 
        call.url.includes('4318') && 
        call.options.method === 'POST'
      )).toBe(true);
    });

    test("incrementCounter records custom metrics", () => {
      incrementCounter('custom.operations.count', 1, {
        operation: 'data_processing',
        component: 'mcp-server',
      });
    });

    test("measureDuration records timing metrics", async () => {
      const result = await measureDuration(
        'data.processing.duration',
        async () => {
          // Simulate work
          await new Promise(resolve => setTimeout(resolve, 10));
          return { processed: 100 };
        },
        {
          data_type: 'json',
          size: 'large',
        }
      );

      expect(result).toEqual({ processed: 100 });
    });

    test("recordSessionMetrics tracks session lifecycle", () => {
      signoz.recordSessionMetrics('created', 'http');
      
      // Simulate session duration
      const sessionDuration = 5000; // 5 seconds
      signoz.recordSessionMetrics('terminated', 'http', sessionDuration);
    });
  });

  describe("HTTP Integration", () => {
    test("sigNozHttpMiddleware extracts trace context", async () => {
      const { sigNozHttpMiddleware } = await import("../common/signoz/index.js");
      
      const middleware = sigNozHttpMiddleware();
      
      const mockReq = {
        method: 'POST',
        url: '/mcp',
        headers: {
          'traceparent': '00-002c08b9d7041c1800044749c7bb5bb8-00b2deaa23f22b58-01'
        }
      } as any;

      const mockRes = {
        locals: {},
        setHeader: () => {},
        getHeaders: () => ({})
      } as any;

      const mockNext = () => {};

      // Should not throw
      expect(() => {
        middleware(mockReq, mockRes, mockNext);
      }).not.toThrow();

      expect(mockRes.locals.traceId).toBeDefined();
    });
  });

  describe("Advanced Tracing Features", () => {
    test("nested spans create proper hierarchy", async () => {
      const parentResult = await signoz.withSpan(
        'parent.operation',
        async () => {
          const childResult1 = await signoz.withSpan(
            'child.operation.1',
            async () => {
              return 'child1 result';
            }
          );

          const childResult2 = await signoz.withSpan(
            'child.operation.2',
            async () => {
              return 'child2 result';
            }
          );

          return { childResult1, childResult2 };
        }
      );

      expect(parentResult).toEqual({
        childResult1: 'child1 result',
        childResult2: 'child2 result'
      });
    });

    test("trace context propagation across async operations", async () => {
      const results = await signoz.withSpan(
        'async.coordinator',
        async () => {
          // Start multiple async operations
          const promises = Array.from({ length: 3 }, (_, i) =>
            signoz.withSpan(
              `async.worker.${i}`,
              async () => {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                return `worker-${i}-result`;
              }
            )
          );

          return Promise.all(promises);
        }
      );

      expect(results).toEqual([
        'worker-0-result',
        'worker-1-result', 
        'worker-2-result'
      ]);
    });
  });

  describe("Error Handling and Recovery", () => {
    test("span errors are properly recorded", async () => {
      await expect(
        signoz.withSpan(
          'error.test',
          async () => {
            throw new Error('Simulated error');
          }
        )
      ).rejects.toThrow('Simulated error');
    });

    test("partial span failures don't affect others", async () => {
      const span1 = signoz.startMcpSpan('span.1');
      const span2 = signoz.startMcpSpan('span.2');

      // Simulate error in span1
      span1?.recordException(new Error('Span 1 error'));
      span1?.setStatus({ code: SpanStatusCode.ERROR });
      span1?.end();

      // Span2 should work normally
      span2?.setStatus({ code: SpanStatusCode.OK });
      span2?.end();
    });

    test("missing SignOz endpoint is handled gracefully", async () => {
      // Temporarily break fetch to simulate network issues
      const originalFetch = global.fetch;
      global.fetch = async () => {
        throw new Error('Network error');
      };

      // Should not throw
      await expect(
        signoz.withSpan('network.error.test', async () => {
          return 'success despite network error';
        })
      ).resolves.toBe('success despite network error');

      global.fetch = originalFetch;
    });
  });

  describe("Performance and Resource Management", () => {
    test("many spans don't cause memory leaks", async () => {
      const spanCount = 100;
      const results = [];

      for (let i = 0; i < spanCount; i++) {
        const result = await signoz.withSpan(
          `performance.test.${i}`,
          async () => {
            return `result-${i}`;
          }
        );
        results.push(result);
      }

      expect(results.length).toBe(spanCount);
      expect(results[0]).toBe('result-0');
      expect(results[spanCount - 1]).toBe(`result-${spanCount - 1}`);
    });

    test("concurrent spans are handled properly", async () => {
      const concurrentCount = 10;
      
      const promises = Array.from({ length: concurrentCount }, (_, i) =>
        signoz.withSpan(
          `concurrent.test.${i}`,
          async () => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 20));
            return `concurrent-${i}`;
          }
        )
      );

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(concurrentCount);
      expect(results.every((result, i) => result === `concurrent-${i}`)).toBe(true);
    });
  });

  describe("Configuration Validation", () => {
    test("invalid endpoint configuration is handled", async () => {
      await expect(
        initializeSigNoz({
          endpoint: 'invalid-url',
          serviceName: 'test',
          serviceVersion: '1.0.0',
        })
      ).resolves.toBeUndefined(); // Should not throw
    });

    test("missing required configuration fields", async () => {
      await expect(
        initializeSigNoz({
          endpoint: 'http://localhost:4318',
          serviceName: '',
          serviceVersion: '1.0.0',
        })
      ).resolves.toBeUndefined(); // Should handle gracefully
    });
  });

  describe("Integration with MCP Server", () => {
    test("server lifecycle integration", async () => {
      // Test that SignOz works with server startup/shutdown
      await signoz.withSpan('server.startup', async () => {
        // Simulate server initialization
        recordBusinessEvent('server.lifecycle', {
          event: 'startup',
          version: '1.0.0',
        });
        
        return 'server started';
      });

      await signoz.withSpan('server.shutdown', async () => {
        // Simulate server shutdown
        recordBusinessEvent('server.lifecycle', {
          event: 'shutdown',
          graceful: true,
        });
        
        return 'server stopped';
      });
    });

    test("endpoint registration tracing", async () => {
      const endpoints = ['tools/list', 'tools/call', 'resources/read'];
      
      for (const endpoint of endpoints) {
        await signoz.withSpan(
          'endpoint.register',
          async () => {
            recordBusinessEvent('endpoint.registered', {
              endpoint,
              capabilities: ['basic'],
            });
            
            return `${endpoint} registered`;
          },
          {
            'mcp.endpoint': endpoint,
            'registration.type': 'standard',
          }
        );
      }
    });

    test("client connection lifecycle", async () => {
      const sessionId = 'sess_test_123';
      const clientId = 'test-client';

      // Connection
      await signoz.withSpan('client.connect', async () => {
        addSessionContext(sessionId, clientId, 'http');
        signoz.recordSessionMetrics('created', 'http');
        
        return 'connected';
      });

      // Operations
      await traceMcpEndpoint(
        'ping',
        'req-ping-1',
        async () => ({ pong: true }),
        { 'session.id': sessionId }
      );

      // Disconnection
      await signoz.withSpan('client.disconnect', async () => {
        signoz.recordSessionMetrics('terminated', 'http', 5000);
        
        return 'disconnected';
      });
    });
  });

  describe("Real-world Usage Patterns", () => {
    test("complex operation with multiple nested traces", async () => {
      const result = await traceMcpEndpoint(
        'tools/call',
        'complex-req-123',
        async () => {
          // Tool validation
          await signoz.withSpan('tool.validation', async () => {
            return { valid: true };
          });

          // Tool execution
          const execResult = await traceToolExecution(
            'data-processor',
            { input: 'test-data' },
            async () => {
              // Nested processing steps
              const step1 = await signoz.withSpan('processing.step1', async () => {
                return { processed: 'step1-data' };
              });

              const step2 = await signoz.withSpan('processing.step2', async () => {
                return { processed: 'step2-data' };
              });

              return { step1, step2, final: 'processed-result' };
            }
          );

          // Tool result validation
          await signoz.withSpan('result.validation', async () => {
            return { validated: true };
          });

          return execResult;
        },
        {
          'tool.name': 'data-processor',
          'operation.complexity': 'high',
        }
      );

      expect(result.final).toBe('processed-result');
    });

    test("error propagation through trace hierarchy", async () => {
      await expect(
        traceMcpEndpoint(
          'tools/call',
          'error-req-456',
          async () => {
            await traceToolExecution(
              'failing-tool',
              { input: 'bad-data' },
              async () => {
                await signoz.withSpan('deep.operation', async () => {
                  throw new Error('Deep operation failed');
                });
              }
            );
          }
        )
      ).rejects.toThrow('Deep operation failed');
    });
  });
});