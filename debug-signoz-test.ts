#!/usr/bin/env bun

/**
 * Debug SignOz Test - Multiple Distinct Spans
 * 
 * This test creates multiple distinct spans with different names and attributes
 * to debug why only one span appears in SignOz
 */

import { initializeSigNoz } from "./common/signoz/init.js";
import { signoz } from "./common/signoz/index.js";

async function runDebugTest() {
  console.log("🔍 Debug SignOz Test - Multiple Distinct Spans");
  console.log("===============================================\n");

  // Ensure clean start
  await signoz.shutdown();

  // Initialize SignOz with explicit configuration
  await initializeSigNoz({
    endpoint: 'http://localhost:4318',
    serviceName: 'test-service',
    serviceVersion: '1.0.0',
    environment: 'test',
    features: {
      traces: true,
      metrics: true,
      logs: false,
    },
    customAttributes: {
      testType: 'debug',
      debugMode: true,
    },
  });

  if (!signoz.isInitialized()) {
    console.log("❌ SignOz not initialized - check if SignOz is running");
    return;
  }

  console.log("✅ SignOz initialized successfully\n");

  // Create multiple spans with very different names and attributes
  console.log("1️⃣ Creating spans with different names");
  
  // Span 1: Original test-span
  const span1 = signoz.startMcpSpan('test-span', {
    'test.attribute': 'test-value',
    'span.number': 1,
    'span.type': 'original',
  });
  
  span1?.addEvent('span1.created');
  span1?.setStatus({ code: 1 });
  span1?.end();
  console.log("   ✅ Created span1: test-span");

  // Wait between spans
  await new Promise(resolve => setTimeout(resolve, 100));

  // Span 2: Different name
  const span2 = signoz.startMcpSpan('user-authentication', {
    'test.attribute': 'auth-value',
    'span.number': 2,
    'span.type': 'authentication',
    'user.id': 'user123',
  });
  
  span2?.addEvent('auth.started');
  span2?.addEvent('auth.completed');
  span2?.setStatus({ code: 1 });
  span2?.end();
  console.log("   ✅ Created span2: user-authentication");

  await new Promise(resolve => setTimeout(resolve, 100));

  // Span 3: Business operation
  const span3 = signoz.startMcpSpan('data-processing', {
    'test.attribute': 'processing-value',
    'span.number': 3,
    'span.type': 'business',
    'operation.type': 'data_transform',
    'records.count': 150,
  });
  
  span3?.addEvent('processing.started');
  span3?.addEvent('processing.completed');
  span3?.setStatus({ code: 1 });
  span3?.end();
  console.log("   ✅ Created span3: data-processing");

  await new Promise(resolve => setTimeout(resolve, 100));

  // Span 4: Error scenario
  const span4 = signoz.startMcpSpan('error-handling', {
    'test.attribute': 'error-value',
    'span.number': 4,
    'span.type': 'error',
    'error.type': 'validation_error',
    'error.code': 400,
  });
  
  span4?.addEvent('error.detected');
  span4?.addEvent('error.handled');
  span4?.setStatus({ code: 2 }); // ERROR status
  span4?.end();
  console.log("   ✅ Created span4: error-handling");

  await new Promise(resolve => setTimeout(resolve, 100));

  // Span 5: Performance test
  const span5 = signoz.startMcpSpan('performance-test', {
    'test.attribute': 'perf-value',
    'span.number': 5,
    'span.type': 'performance',
    'test.duration': '50ms',
    'test.load': 'high',
  });
  
  span5?.addEvent('perf.started');
  await new Promise(resolve => setTimeout(resolve, 50));
  span5?.addEvent('perf.completed');
  span5?.setStatus({ code: 1 });
  span5?.end();
  console.log("   ✅ Created span5: performance-test");

  console.log("\n2️⃣ Creating nested spans with withSpan");
  
  // Nested span operation
  await signoz.withSpan(
    'nested-operation',
    async () => {
      console.log("   ✅ In nested-operation span");
      
      await signoz.withSpan(
        'child-task-1',
        async () => {
          console.log("   ✅ In child-task-1 span");
          await new Promise(resolve => setTimeout(resolve, 20));
        },
        {
          'test.attribute': 'child1-value',
          'task.number': 1,
          'task.type': 'child',
        }
      );
      
      await signoz.withSpan(
        'child-task-2',
        async () => {
          console.log("   ✅ In child-task-2 span");
          await new Promise(resolve => setTimeout(resolve, 30));
        },
        {
          'test.attribute': 'child2-value',
          'task.number': 2,
          'task.type': 'child',
        }
      );
    },
    {
      'test.attribute': 'nested-value',
      'operation.type': 'nested',
      'child.count': 2,
    }
  );

  // Force export by waiting longer
  console.log("\n⏳ Waiting 5 seconds for batch export to SignOz...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log("\n🎉 Debug Test Complete!");
  console.log("======================");
  console.log("📊 Check SignOz UI at: http://localhost:3301");
  console.log("🔍 Service Name: test-service");
  console.log("📝 Expected 8 distinct spans:");
  console.log("   1. test-span (span.number: 1)");
  console.log("   2. user-authentication (span.number: 2)");
  console.log("   3. data-processing (span.number: 3)");
  console.log("   4. error-handling (span.number: 4, ERROR status)");
  console.log("   5. performance-test (span.number: 5)");
  console.log("   6. nested-operation (parent span)");
  console.log("   7. child-task-1 (child span)");
  console.log("   8. child-task-2 (child span)");
  console.log();
  console.log("🎯 Each span has unique attributes for identification");
  console.log("📈 Look for 'test.attribute' and 'span.number' fields");
}

// Run the test
runDebugTest().catch(error => {
  console.error("❌ Debug test failed:", error);
  process.exit(1);
});