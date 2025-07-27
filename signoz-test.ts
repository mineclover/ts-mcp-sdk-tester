#!/usr/bin/env bun

/**
 * SignOz Specific Test Script
 *
 * Creates diverse, well-named spans for SignOz visualization and testing
 * Each span has distinct names and attributes for easy identification
 */

import { logger } from "./standard/logger.js";
import { initializeSigNoz } from "./common/signoz/init.js";
import { signoz } from "./common/signoz/index.js";
import {
  traceMcpEndpoint,
  addSessionContext,
  recordBusinessEvent,
} from "./common/signoz/helpers.js";
import { MCP_SPAN_NAMES } from "./common/otel/types.js";

async function runSignOzTest() {
  console.log("🌐 SignOz Trace Diversity Test");
  console.log("==============================\n");

  // Initialize SignOz
  await initializeSigNoz({
    endpoint: "http://localhost:4318",
    serviceName: "mcp-signoz-tester",
    serviceVersion: "1.0.0",
    environment: "test",
    features: {
      traces: true,
      metrics: true,
      logs: false,
    },
    customAttributes: {
      testSuite: "signoz-diversity",
      environment: "test",
    },
  });

  if (!signoz.isInitialized()) {
    console.log("❌ SignOz not initialized - check SIGNOZ_ENDPOINT");
    return;
  }

  console.log("✅ SignOz initialized successfully\n");

  // Test 1: MCP Protocol Operations
  console.log("1️⃣ Testing MCP Protocol Operations");

  await traceMcpEndpoint(
    "ping",
    "ping-req-001",
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { pong: true };
    },
    {
      "mcp.operation": "ping",
      "test.category": "protocol",
      "test.id": "ping-001",
    }
  );

  await traceMcpEndpoint(
    "initialize",
    "init-req-001",
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return {
        protocolVersion: "2025-06-18",
        serverInfo: { name: "signoz-test", version: "1.0.0" },
      };
    },
    {
      "mcp.operation": "initialize",
      "test.category": "protocol",
      "test.id": "init-001",
    }
  );

  console.log("   ✅ Protocol operations traced\n");

  // Test 2: Tool Operations
  console.log("2️⃣ Testing Tool Operations");

  await traceMcpEndpoint(
    "tools/list",
    "tools-list-001",
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 8));
      return {
        tools: [
          { name: "calculator", description: "Math operations" },
          { name: "file-reader", description: "File operations" },
        ],
      };
    },
    {
      "mcp.operation": "tools_list",
      "test.category": "tools",
      "test.id": "tools-list-001",
    }
  );

  await traceMcpEndpoint(
    "tools/call",
    "tool-call-calc-001",
    async () => {
      await signoz.withSpan("mcp.tool.execute.calculator", async () => {
        await new Promise((resolve) => setTimeout(resolve, 12));
        return { result: 42 };
      });
      return { content: [{ type: "text", text: "Result: 42" }] };
    },
    {
      "mcp.operation": "tool_call",
      "mcp.tool.name": "calculator",
      "test.category": "tools",
      "test.id": "tool-call-calc-001",
    }
  );

  await traceMcpEndpoint(
    "tools/call",
    "tool-call-file-001",
    async () => {
      await signoz.withSpan("mcp.tool.execute.file_reader", async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return { content: "file content here" };
      });
      return { content: [{ type: "text", text: "File: test.txt" }] };
    },
    {
      "mcp.operation": "tool_call",
      "mcp.tool.name": "file_reader",
      "test.category": "tools",
      "test.id": "tool-call-file-001",
    }
  );

  console.log("   ✅ Tool operations traced\n");

  // Test 3: Resource Operations
  console.log("3️⃣ Testing Resource Operations");

  await traceMcpEndpoint(
    "resources/list",
    "res-list-001",
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        resources: [
          { uri: "file://test.txt", name: "Test File" },
          { uri: "file://config.json", name: "Config File" },
        ],
      };
    },
    {
      "mcp.operation": "resources_list",
      "test.category": "resources",
      "test.id": "res-list-001",
    }
  );

  await traceMcpEndpoint(
    "resources/read",
    "res-read-001",
    async () => {
      await signoz.withSpan("mcp.resource.read.test_txt", async () => {
        await new Promise((resolve) => setTimeout(resolve, 18));
        return { content: "test file content" };
      });
      return {
        contents: [
          {
            uri: "file://test.txt",
            text: "test file content",
            mimeType: "text/plain",
          },
        ],
      };
    },
    {
      "mcp.operation": "resource_read",
      "mcp.resource.uri": "file://test.txt",
      "test.category": "resources",
      "test.id": "res-read-001",
    }
  );

  console.log("   ✅ Resource operations traced\n");

  // Test 4: Session and Authentication
  console.log("4️⃣ Testing Session & Auth Operations");

  await signoz.withSpan("mcp.session.create", async () => {
    addSessionContext("signoz-test-session", "signoz-test-client", "http");
    await logger.info(
      {
        message: "Session created",
        sessionId: "signoz-test-session",
        clientId: "signoz-test-client",
      },
      "session"
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
  });

  await signoz.withSpan("mcp.auth.validate", async () => {
    await logger.info(
      {
        message: "Validating API key",
        keyLength: 32,
        method: "api_key",
      },
      "auth"
    );
    await new Promise((resolve) => setTimeout(resolve, 3));
  });

  await signoz.withSpan("mcp.auth.rate_limit", async () => {
    await logger.info(
      {
        message: "Rate limit check",
        limit: 100,
        remaining: 95,
      },
      "auth"
    );
    await new Promise((resolve) => setTimeout(resolve, 2));
  });

  console.log("   ✅ Session & auth operations traced\n");

  // Test 5: Business Logic Workflows
  console.log("5️⃣ Testing Business Logic Workflows");

  await traceMcpEndpoint(
    "workflow/user_onboarding",
    "workflow-onboard-001",
    async () => {
      // Step 1: User validation
      await signoz.withSpan("mcp.business.user_validation", async () => {
        await logger.info(
          {
            message: "Validating user data",
            step: 1,
            workflow: "user_onboarding",
          },
          "business"
        );
        await new Promise((resolve) => setTimeout(resolve, 8));
      });

      // Step 2: Account creation
      await signoz.withSpan("mcp.business.account_creation", async () => {
        await logger.info(
          {
            message: "Creating user account",
            step: 2,
            workflow: "user_onboarding",
          },
          "business"
        );
        await new Promise((resolve) => setTimeout(resolve, 15));
      });

      // Step 3: Welcome notification
      await signoz.withSpan("mcp.business.notification_send", async () => {
        await logger.info(
          {
            message: "Sending welcome notification",
            step: 3,
            workflow: "user_onboarding",
          },
          "business"
        );
        await new Promise((resolve) => setTimeout(resolve, 6));
      });

      return {
        workflow: "user_onboarding",
        status: "completed",
        userId: "user-123",
      };
    },
    {
      "workflow.type": "user_onboarding",
      "workflow.steps": 3,
      "test.category": "business_logic",
      "test.id": "workflow-onboard-001",
    }
  );

  console.log("   ✅ Business workflows traced\n");

  // Test 6: Error Scenarios
  console.log("6️⃣ Testing Error Scenarios");

  // Validation error
  try {
    await traceMcpEndpoint(
      "test/validation_error",
      "error-validation-001",
      async () => {
        await signoz.withSpan("mcp.validation.parameters", async () => {
          await new Promise((resolve) => setTimeout(resolve, 3));
          throw new Error("Invalid parameter: age must be positive");
        });
      },
      {
        "error.type": "validation_error",
        "error.category": "client_error",
        "test.category": "error_handling",
        "test.id": "error-validation-001",
      }
    );
  } catch (error) {
    console.log(`   ✅ Validation error traced: ${error.message}`);
  }

  // Network timeout error
  try {
    await traceMcpEndpoint(
      "test/timeout_error",
      "error-timeout-001",
      async () => {
        await signoz.withSpan("mcp.external.api_call", async () => {
          await new Promise((resolve) => setTimeout(resolve, 35));
          throw new Error("Request timeout after 30s");
        });
      },
      {
        "error.type": "timeout_error",
        "error.category": "network_error",
        "test.category": "error_handling",
        "test.id": "error-timeout-001",
      }
    );
  } catch (error) {
    console.log(`   ✅ Timeout error traced: ${error.message}`);
  }

  // Database error
  try {
    await traceMcpEndpoint(
      "test/database_error",
      "error-db-001",
      async () => {
        await signoz.withSpan("mcp.database.query", async () => {
          await new Promise((resolve) => setTimeout(resolve, 12));
          throw new Error("Connection pool exhausted");
        });
      },
      {
        "error.type": "database_error",
        "error.category": "infrastructure_error",
        "test.category": "error_handling",
        "test.id": "error-db-001",
      }
    );
  } catch (error) {
    console.log(`   ✅ Database error traced: ${error.message}`);
  }

  console.log();

  // Test 7: Performance Scenarios
  console.log("7️⃣ Testing Performance Scenarios");

  // Fast operations
  const fastOps = Array.from({ length: 3 }, (_, i) =>
    traceMcpEndpoint(
      `perf/fast_operation_${i}`,
      `fast-op-${i}`,
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 2 + Math.random() * 3));
        return { operation: i, type: "fast", duration: "under_5ms" };
      },
      {
        "perf.category": "fast_operations",
        "perf.operation_id": i,
        "test.category": "performance",
        "test.id": `fast-op-${i}`,
      }
    )
  );

  // Medium operations
  const mediumOps = Array.from({ length: 3 }, (_, i) =>
    traceMcpEndpoint(
      `perf/medium_operation_${i}`,
      `medium-op-${i}`,
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 15));
        return { operation: i, type: "medium", duration: "10_25ms" };
      },
      {
        "perf.category": "medium_operations",
        "perf.operation_id": i,
        "test.category": "performance",
        "test.id": `medium-op-${i}`,
      }
    )
  );

  // Slow operations
  const slowOps = Array.from({ length: 2 }, (_, i) =>
    traceMcpEndpoint(
      `perf/slow_operation_${i}`,
      `slow-op-${i}`,
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 30));
        return { operation: i, type: "slow", duration: "over_50ms" };
      },
      {
        "perf.category": "slow_operations",
        "perf.operation_id": i,
        "test.category": "performance",
        "test.id": `slow-op-${i}`,
      }
    )
  );

  await Promise.all([...fastOps, ...mediumOps, ...slowOps]);
  console.log("   ✅ Performance scenarios traced\n");

  // Test 8: Business Events
  console.log("8️⃣ Testing Business Events");

  const businessSpan = signoz.startMcpSpan("mcp.business.metrics_collection", {
    "business.operation": "metrics_collection",
    "test.category": "business_events",
  });

  recordBusinessEvent("mcp.business.user_action", {
    action: "login",
    userId: "user-123",
    success: true,
    timestamp: Date.now(),
  });

  recordBusinessEvent("mcp.business.feature_usage", {
    feature: "file_upload",
    userId: "user-123",
    fileSize: 1024,
    fileType: "json",
  });

  recordBusinessEvent("mcp.business.transaction", {
    type: "api_call",
    endpoint: "tools/call",
    duration: 125,
    success: true,
  });

  businessSpan?.end();
  console.log("   ✅ Business events recorded\n");

  // Wait for traces to be sent
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("🎉 SignOz Test Complete!");
  console.log("========================");
  console.log("📊 Check SignOz UI at: http://localhost:3301");
  console.log("🔍 Service Name: mcp-signoz-tester");
  console.log();
  console.log("Expected Traces in SignOz:");
  console.log("• mcp.endpoint.ping");
  console.log("• mcp.endpoint.initialize");
  console.log("• mcp.endpoint.tools.list");
  console.log("• mcp.endpoint.tools.call");
  console.log("• mcp.endpoint.resources.list");
  console.log("• mcp.endpoint.resources.read");
  console.log("• mcp.session.create");
  console.log("• mcp.auth.validate");
  console.log("• mcp.auth.rate_limit");
  console.log("• mcp.business.* (various business operations)");
  console.log("• mcp.tool.execute.calculator");
  console.log("• mcp.tool.execute.file_reader");
  console.log("• mcp.resource.read.test_txt");
  console.log("• mcp.endpoint.workflow.user_onboarding");
  console.log("• mcp.endpoint.test.validation_error");
  console.log("• mcp.endpoint.test.timeout_error");
  console.log("• mcp.endpoint.test.database_error");
  console.log("• mcp.endpoint.perf.* (performance operations)");
  console.log();
  console.log("💡 Each trace has unique attributes for filtering and analysis");
}

// Run the test
runSignOzTest().catch((error) => {
  console.error("❌ SignOz test failed:", error);
  process.exit(1);
});
