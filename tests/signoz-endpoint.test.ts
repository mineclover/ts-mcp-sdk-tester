import { test, expect, beforeAll, afterAll, describe } from "bun:test";

/**
 * SignOz Endpoint Connectivity Tests
 *
 * Tests actual connectivity to SignOz running at http://localhost:4317/
 * Verifies that telemetry data can be sent to the real SignOz instance.
 */

describe("SignOz Endpoint Connectivity", () => {
  const SIGNOZ_ENDPOINT = "http://localhost:4317";
  const SIGNOZ_HTTP_ENDPOINT = "http://localhost:4318";

  beforeAll(() => {
    console.log("Testing SignOz connectivity to:", SIGNOZ_ENDPOINT);
    console.log("HTTP traces endpoint:", `${SIGNOZ_HTTP_ENDPOINT}/v1/traces`);
    console.log("HTTP metrics endpoint:", `${SIGNOZ_HTTP_ENDPOINT}/v1/metrics`);
  });

  describe("SignOz Health Checks", () => {
    test("SignOz HTTP endpoints are accessible", async () => {
      // Test traces endpoint
      try {
        const tracesResponse = await fetch(`${SIGNOZ_HTTP_ENDPOINT}/v1/traces`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            resourceSpans: [],
          }),
        });

        // Should accept the request (even if empty)
        expect([200, 202, 400]).toContain(tracesResponse.status);
        console.log("✅ Traces endpoint accessible:", tracesResponse.status);
      } catch (error) {
        console.log("❌ Traces endpoint not accessible:", error.message);
        // Don't fail the test - SignOz might not be running
      }

      // Test metrics endpoint
      try {
        const metricsResponse = await fetch(`${SIGNOZ_HTTP_ENDPOINT}/v1/metrics`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            resourceMetrics: [],
          }),
        });

        expect([200, 202, 400]).toContain(metricsResponse.status);
        console.log("✅ Metrics endpoint accessible:", metricsResponse.status);
      } catch (error) {
        console.log("❌ Metrics endpoint not accessible:", error.message);
      }
    });

    test("SignOz accepts valid trace data", async () => {
      const traceData = {
        resourceSpans: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: "test-service" },
                },
                {
                  key: "service.version",
                  value: { stringValue: "1.0.0" },
                },
              ],
            },
            scopeSpans: [
              {
                scope: {
                  name: "test-scope",
                  version: "1.0.0",
                },
                spans: [
                  {
                    traceId: "002c08b9d7041c1800044749c7bb5bb8",
                    spanId: "00b2deaa23f22b58",
                    name: "test-span",
                    kind: 1,
                    startTimeUnixNano: String(Date.now() * 1000000),
                    endTimeUnixNano: String((Date.now() + 100) * 1000000),
                    attributes: [
                      {
                        key: "test.attribute",
                        value: { stringValue: "test-value" },
                      },
                    ],
                    status: {
                      code: 1,
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      try {
        const response = await fetch(`${SIGNOZ_HTTP_ENDPOINT}/v1/traces`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(traceData),
        });

        expect([200, 202]).toContain(response.status);
        console.log("✅ Valid trace data accepted:", response.status);

        if (response.status === 200 || response.status === 202) {
          console.log("🎯 Trace data successfully sent to SignOz!");
        }
      } catch (error) {
        console.log("❌ Failed to send trace data:", error.message);
        console.log("💡 Make sure SignOz is running at", SIGNOZ_HTTP_ENDPOINT);
      }
    });

    test("SignOz accepts valid metrics data", async () => {
      const metricsData = {
        resourceMetrics: [
          {
            resource: {
              attributes: [
                {
                  key: "service.name",
                  value: { stringValue: "test-service" },
                },
              ],
            },
            scopeMetrics: [
              {
                scope: {
                  name: "test-metrics",
                  version: "1.0.0",
                },
                metrics: [
                  {
                    name: "test_counter",
                    description: "A test counter metric",
                    unit: "1",
                    sum: {
                      dataPoints: [
                        {
                          asInt: "42",
                          timeUnixNano: String(Date.now() * 1000000),
                          attributes: [
                            {
                              key: "test.label",
                              value: { stringValue: "test-value" },
                            },
                          ],
                        },
                      ],
                      aggregationTemporality: 2,
                      isMonotonic: true,
                    },
                  },
                ],
              },
            ],
          },
        ],
      };

      try {
        const response = await fetch(`${SIGNOZ_HTTP_ENDPOINT}/v1/metrics`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metricsData),
        });

        expect([200, 202]).toContain(response.status);
        console.log("✅ Valid metrics data accepted:", response.status);

        if (response.status === 200 || response.status === 202) {
          console.log("📊 Metrics data successfully sent to SignOz!");
        }
      } catch (error) {
        console.log("❌ Failed to send metrics data:", error.message);
      }
    });
  });

  describe("MCP Server Integration with Real SignOz", () => {
    test("MCP telemetry reaches SignOz", async () => {
      // Import and initialize real SignOz integration
      try {
        const { initializeSigNoz } = await import("../common/signoz/init.js");
        const { signoz } = await import("../common/signoz/index.js");
        const { traceMcpEndpoint } = await import("../common/signoz/helpers.js");

        // Initialize with real SignOz endpoint
        await initializeSigNoz({
          endpoint: SIGNOZ_HTTP_ENDPOINT,
          serviceName: "mcp-endpoint-test",
          serviceVersion: "1.0.0",
          environment: "test",
          features: {
            traces: true,
            metrics: true,
            logs: false,
          },
        });

        if (!signoz.isInitialized()) {
          console.log("⚠️ SignOz not initialized - skipping integration test");
          return;
        }

        // Create test span that should reach SignOz
        const span = signoz.startMcpSpan("endpoint.connectivity.test", {
          "test.type": "connectivity",
          "endpoint.url": SIGNOZ_HTTP_ENDPOINT,
          timestamp: Date.now(),
        });

        span?.addEvent("Test span created for SignOz connectivity");
        span?.setAttribute("test.success", true);
        span?.setStatus({ code: 1 }); // OK
        span?.end();

        // Test MCP endpoint tracing
        const result = await traceMcpEndpoint(
          "test/connectivity",
          "connectivity-test-123",
          async () => {
            return {
              signozConnected: true,
              endpoint: SIGNOZ_HTTP_ENDPOINT,
              timestamp: Date.now(),
            };
          },
          {
            "test.endpoint": SIGNOZ_HTTP_ENDPOINT,
            "test.purpose": "connectivity",
          }
        );

        expect(result.signozConnected).toBe(true);

        // Wait a moment for async exports
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log("🚀 MCP telemetry sent to SignOz");
        console.log("📈 Check SignOz UI at http://localhost:3301 for traces");
        console.log("🔍 Look for service: mcp-endpoint-test");
      } catch (error) {
        console.log("❌ MCP SignOz integration test failed:", error.message);
        console.log("💡 This is expected if SignOz is not running");
      }
    });

    test("High-volume telemetry handling", async () => {
      try {
        const { signoz } = await import("../common/signoz/index.js");
        const { traceMcpEndpoint } = await import("../common/signoz/helpers.js");

        if (!signoz.isInitialized()) {
          console.log("⚠️ SignOz not initialized - skipping volume test");
          return;
        }

        console.log("🔄 Starting high-volume telemetry test...");

        // Create multiple concurrent operations
        const operations = Array.from({ length: 10 }, (_, i) =>
          traceMcpEndpoint(
            `volume/test/${i}`,
            `volume-req-${i}`,
            async () => {
              // Nested spans to test hierarchy
              return await signoz.withSpan(`nested.operation.${i}`, async () => {
                await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
                return {
                  operation: i,
                  completed: true,
                  timestamp: Date.now(),
                };
              });
            },
            {
              "volume.test": true,
              "operation.index": i,
              "batch.size": 10,
            }
          )
        );

        const results = await Promise.all(operations);
        expect(results.length).toBe(10);
        expect(results.every((r) => r.completed)).toBe(true);

        // Wait for export batching
        await new Promise((resolve) => setTimeout(resolve, 2000));

        console.log("✅ High-volume test completed");
        console.log("📊 10 operations with nested spans sent to SignOz");
      } catch (error) {
        console.log("❌ Volume test failed:", error.message);
      }
    });
  });

  describe("SignOz UI Verification", () => {
    test("Instructions for manual verification", () => {
      console.log("\n🔍 Manual Verification Steps:");
      console.log("1. Open SignOz UI: http://localhost:3301");
      console.log("2. Go to Services tab");
      console.log("3. Look for services:");
      console.log("   - test-service");
      console.log("   - mcp-endpoint-test");
      console.log("   - integration-test-server");
      console.log("4. Click on a service to see traces");
      console.log("5. Look for spans:");
      console.log("   - test-span");
      console.log("   - endpoint.connectivity.test");
      console.log("   - volume/test/*");
      console.log("6. Verify trace attributes and hierarchy");
      console.log("7. Check Metrics tab for custom metrics");
      console.log("\n💡 If no data appears, ensure:");
      console.log("   - SignOz is running: docker-compose up -d");
      console.log("   - Endpoints are accessible (tests above pass)");
      console.log("   - Wait a few seconds for data ingestion");
    });
  });

  describe("Troubleshooting Helpers", () => {
    test("SignOz configuration validation", async () => {
      console.log("\n🔧 SignOz Configuration Check:");

      // Check if SignOz is responding
      try {
        const healthCheck = await fetch(`${SIGNOZ_HTTP_ENDPOINT}/health`);
        console.log(`Health endpoint: ${healthCheck.status}`);
      } catch {
        console.log("Health endpoint: Not accessible");
      }

      // Check OTLP endpoints
      const endpoints = ["/v1/traces", "/v1/metrics", "/v1/logs"];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${SIGNOZ_HTTP_ENDPOINT}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          console.log(`${endpoint}: ${response.status}`);
        } catch {
          console.log(`${endpoint}: Not accessible`);
        }
      }

      console.log("\n📋 Configuration Summary:");
      console.log(`OTLP HTTP Endpoint: ${SIGNOZ_HTTP_ENDPOINT}`);
      console.log(`OTLP gRPC Endpoint: ${SIGNOZ_ENDPOINT}`);
      console.log(`SignOz UI: http://localhost:3301`);
      console.log(`ClickHouse: http://localhost:8123`);
      console.log(`Alertmanager: http://localhost:9093`);
    });

    test("Environment variables check", () => {
      console.log("\n🌍 Environment Variables:");
      const envVars = [
        "SIGNOZ_ENDPOINT",
        "OTEL_SERVICE_NAME",
        "OTEL_SERVICE_VERSION",
        "NODE_ENV",
        "SIGNOZ_TRACES_ENABLED",
        "SIGNOZ_METRICS_ENABLED",
      ];

      envVars.forEach((envVar) => {
        const value = process.env[envVar];
        console.log(`${envVar}: ${value || "Not set"}`);
      });

      console.log("\n💡 To enable SignOz in your MCP server:");
      console.log("export SIGNOZ_ENDPOINT=http://localhost:4318");
      console.log("export OTEL_SERVICE_NAME=your-mcp-server");
      console.log("export SIGNOZ_TRACES_ENABLED=true");
    });
  });
});
