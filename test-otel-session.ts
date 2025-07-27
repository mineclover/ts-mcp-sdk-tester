#!/usr/bin/env bun

/**
 * Simple test for OTel session integration
 */

import { logger } from "./standard/logger.js";
import { SessionManager, TraceManager, createSessionFromRequest } from "./standard/otel-session.js";

async function testOTelSession() {
  console.log("🧪 Testing OTel Session Integration...\n");

  // 1. Test session creation
  console.log("1. Creating test session...");
  const sessionManager = SessionManager.getInstance();
  const session = sessionManager.createSession({
    clientId: "test-client-123",
    transportType: "http",
    userAgent: "MCP-Client/1.0.0",
    remoteAddress: "127.0.0.1",
    capabilities: ["tools", "resources", "prompts"],
  });

  console.log(`   ✅ Session created: ${session.sessionId}`);
  console.log(`   📊 Transport: ${session.transportType}, Client: ${session.clientId}`);

  // 2. Test logger with session context
  console.log("\n2. Testing logger with session context...");
  logger.setSessionContext(session.sessionId);

  // 3. Test operation tracing
  console.log("\n3. Testing operation tracing...");
  const traceId = logger.startOperation("test.operation", {
    "test.param": "value",
    "test.number": 42,
  });

  console.log(`   ✅ Operation trace started: ${traceId}`);

  // 4. Test enhanced logging
  console.log("\n4. Testing enhanced logging...");
  await logger.info(
    {
      message: "Test operation in progress",
      operationId: "test-123",
      data: { key: "value" },
    },
    "test"
  );

  await logger.debug("Debug message with session context", "test");

  // 5. Test endpoint logging with tracing
  console.log("\n5. Testing endpoint logging...");
  const endpointTraceId = await logger.logEndpointEntry("tools/call", "req-456", {
    name: "calculator",
    arguments: { operation: "add", a: 1, b: 2 },
  });

  console.log(`   ✅ Endpoint trace started: ${endpointTraceId}`);

  // Simulate some work
  await new Promise((resolve) => setTimeout(resolve, 50));

  // End endpoint operation
  await logger.logMethodExit(
    "tools/call",
    {
      requestId: "req-456",
      result: { success: true, value: 3 },
      responseTimeMs: 50,
    },
    "tools",
    endpointTraceId
  );

  // 6. End operation
  if (traceId) {
    logger.endOperation(traceId, {
      "test.result": "success",
      "test.duration": 100,
    });
    console.log(`   ✅ Operation trace ended: ${traceId}`);
  }

  // 7. Test statistics
  console.log("\n6. Getting OTel statistics...");
  const stats = logger.getOTelStats();
  console.log("   📊 Statistics:", JSON.stringify(stats, null, 2));

  // 8. Test HTTP request session creation
  console.log("\n7. Testing HTTP request session creation...");
  const mockReq = {
    headers: {
      "user-agent": "Mozilla/5.0 (Test Browser)",
      "x-client-id": "web-client-789",
      "x-mcp-capabilities": "tools,resources,prompts",
    },
    ip: "192.168.1.100",
  };

  const httpSession = createSessionFromRequest(mockReq);
  console.log(`   ✅ HTTP session created: ${httpSession.sessionId}`);
  console.log(`   📊 Client: ${httpSession.clientId}, IP: ${httpSession.remoteAddress}`);

  // 9. Cleanup
  console.log("\n8. Cleaning up...");
  sessionManager.removeSession(session.sessionId);
  sessionManager.removeSession(httpSession.sessionId);

  const finalStats = logger.getOTelStats();
  console.log(`   ✅ Active sessions after cleanup: ${finalStats.sessionStats.activeSessions}`);

  console.log("\n🎉 OTel Session Integration test completed successfully!");
}

// Run the test
if (import.meta.main) {
  testOTelSession().catch(console.error);
}
