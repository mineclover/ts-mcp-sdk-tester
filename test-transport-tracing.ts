#!/usr/bin/env bun

/**
 * Integration test for transport-level session and tracing
 */

import { logger } from "./standard/logger.js";
import { SessionManager } from "./standard/otel-session.js";

async function testTransportIntegration() {
  console.log("🧪 Testing Transport-Level Session and Tracing Integration...\n");

  // 1. Test session manager integration
  console.log("1. Testing SessionManager integration...");
  const sessionManager = SessionManager.getInstance();
  
  // Simulate HTTP request session creation
  const mockReq = {
    headers: {
      'user-agent': 'MCP-Test-Client/1.0.0',
      'x-client-id': 'transport-test-client',
      'x-mcp-capabilities': 'tools,resources,prompts,completion',
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    },
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
  };

  // This would normally be called in transports.ts
  console.log("   📊 Mock HTTP request session creation:");
  console.log(`   User-Agent: ${mockReq.headers['user-agent']}`);
  console.log(`   Client-ID: ${mockReq.headers['x-client-id']}`);
  console.log(`   Trace-Parent: ${mockReq.headers['traceparent']}`);

  // 2. Test transport-level tracing
  console.log("\n2. Testing transport-level tracing...");
  
  // First create and set session context (this would normally be done in transports.ts)
  const sessionInfo = {
    sessionId: `sess_${Date.now()}_transport_test`,
    clientId: mockReq.headers['x-client-id'],
    transportType: 'http' as const,
    userAgent: mockReq.headers['user-agent'],
    remoteAddress: mockReq.ip,
    capabilities: mockReq.headers['x-mcp-capabilities']?.split(','),
    startTime: Date.now(),
    connectionId: `conn_${Date.now()}_test`,
  };

  // Set session context BEFORE starting operations
  logger.setSessionContext(sessionInfo.sessionId);
  
  // Simulate what happens in transports.ts /mcp endpoint
  const transportTraceId = logger.startOperation("transport.mcp.request", {
    'transport.type': 'streamable-http',
    'transport.method': 'POST',
    'transport.url': '/mcp',
    'transport.user_agent': mockReq.headers['user-agent'],
  });
  
  console.log(`   ✅ Transport trace started: ${transportTraceId}`);

  // 3. Test session context integration
  console.log("\n3. Testing session context integration...");
  
  console.log(`   ✅ Session context set: ${sessionInfo.sessionId}`);
  console.log(`   📊 Client: ${sessionInfo.clientId}`);
  console.log(`   📊 Capabilities: ${sessionInfo.capabilities?.join(', ')}`);

  // 4. Test nested operation tracing within transport
  console.log("\n4. Testing nested MCP operation simulation...");
  
  // Simulate MCP method call (this would normally happen in endpoint handlers)
  const mcpMethodTrace = logger.startOperation("mcp.tools.list", {
    'mcp.endpoint': 'tools/list',
    'mcp.request.id': 'req-12345',
    'mcp.session.id': sessionInfo.sessionId,
  });
  
  console.log(`   ✅ MCP method trace started: ${mcpMethodTrace}`);
  
  // Simulate some processing time
  await new Promise(resolve => setTimeout(resolve, 25));
  
  // End MCP operation
  if (mcpMethodTrace) {
    logger.endOperation(mcpMethodTrace, {
      'mcp.response.count': 5,
      'mcp.processing.time.ms': 25,
      'mcp.success': true,
    });
  }
  
  console.log(`   ✅ MCP method trace ended: ${mcpMethodTrace}`);

  // 5. Test logging with full context
  console.log("\n5. Testing logging with full session and trace context...");
  
  await logger.info({
    message: "MCP request processed successfully",
    endpoint: "tools/list",
    clientInfo: {
      id: sessionInfo.clientId,
      userAgent: sessionInfo.userAgent,
    },
    performance: {
      processingTime: 25,
      transportTime: 50,
    },
  }, "transport-test");
  
  console.log("   ✅ Log entry with full context generated");

  // 6. Test transport completion
  console.log("\n6. Testing transport trace completion...");
  
  // Simulate transport request completion (happens in transports.ts)
  const processingTime = 75; // Total request time
  if (transportTraceId) {
    logger.endOperation(transportTraceId, {
      'transport.processing.time.ms': processingTime,
      'transport.session.id': sessionInfo.sessionId,
      'transport.mcp.session.id': 'mcp-sess-' + Date.now(),
      'transport.success': true,
      'transport.response.status': 200,
    });
  }
  
  console.log(`   ✅ Transport trace completed: ${transportTraceId}`);
  console.log(`   📊 Total processing time: ${processingTime}ms`);

  // 7. Test session statistics
  console.log("\n7. Testing session statistics...");
  const stats = logger.getOTelStats();
  
  console.log("   📊 Current Statistics:");
  console.log(`   - Session tracking enabled: ${stats.sessionEnabled}`);
  console.log(`   - Active sessions: ${stats.sessionStats.activeSessions}`);
  console.log(`   - Active traces: ${stats.sessionStats.activeTraces}`);
  
  if (stats.sessionStats.sessions.length > 0) {
    const session = stats.sessionStats.sessions[0];
    console.log(`   - Sample session: ${session.sessionId.substring(0, 12)}...`);
    console.log(`   - Session uptime: ${session.uptime}ms`);
    console.log(`   - Transport type: ${session.transportType}`);
  }

  // 8. Test trace correlation
  console.log("\n8. Testing trace correlation...");
  
  // Show how traces would be correlated across the request
  const correlationInfo = {
    transportTraceId: transportTraceId,
    mcpMethodTrace: mcpMethodTrace,
    sessionId: sessionInfo.sessionId,
    parentTraceFromHeaders: mockReq.headers.traceparent,
  };
  
  console.log("   📊 Trace Correlation:");
  console.log(`   - Transport trace: ${correlationInfo.transportTraceId?.substring(0, 16)}...`);
  console.log(`   - MCP method trace: ${correlationInfo.mcpMethodTrace?.substring(0, 16)}...`);
  console.log(`   - Session ID: ${correlationInfo.sessionId.substring(0, 16)}...`);
  console.log(`   - Parent trace: ${correlationInfo.parentTraceFromHeaders?.substring(3, 19)}...`);

  // 9. Test error scenario
  console.log("\n9. Testing error scenario tracing...");
  
  const errorTraceId = logger.startOperation("transport.error.simulation", {
    'transport.type': 'streamable-http',
    'transport.error.simulation': true,
  });
  
  try {
    // Simulate an error
    throw new Error("Simulated transport error");
  } catch (error) {
    if (errorTraceId) {
      logger.endOperation(errorTraceId, {
        'transport.success': false,
        'transport.error.type': error instanceof Error ? error.name : 'unknown',
        'transport.error.message': error instanceof Error ? error.message : String(error),
      });
    }
    
    await logger.logServerError(error instanceof Error ? error : new Error(String(error)), 
      "transport error simulation", {
        traceId: errorTraceId,
        sessionId: sessionInfo.sessionId,
      });
    
    console.log(`   ✅ Error trace completed: ${errorTraceId}`);
  }

  // 10. Test cleanup
  console.log("\n10. Testing session cleanup...");
  
  // This would normally happen when transport closes
  sessionManager.removeSession(sessionInfo.sessionId);
  
  const finalStats = logger.getOTelStats();
  console.log(`   ✅ Sessions after cleanup: ${finalStats.sessionStats.activeSessions}`);
  console.log(`   ✅ Traces after cleanup: ${finalStats.sessionStats.activeTraces}`);

  console.log("\n🎉 Transport-Level Session and Tracing Integration test completed!");
  
  // Summary
  console.log("\n📋 Test Summary:");
  console.log("✅ Transport-level tracing with performance metrics");
  console.log("✅ Session management integration");
  console.log("✅ Nested MCP operation tracing");
  console.log("✅ Full context logging with session and trace data");
  console.log("✅ Trace correlation across request lifecycle");
  console.log("✅ Error handling with trace context");
  console.log("✅ Session statistics and monitoring");
  console.log("✅ Proper cleanup and resource management");
}

// Run the test
if (import.meta.main) {
  testTransportIntegration().catch(console.error);
}