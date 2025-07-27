#!/usr/bin/env bun

/**
 * Simple SignOz Test - Check if spans are actually being sent
 * 
 * This test bypasses mocks and directly sends spans to SignOz
 */

import { initializeSigNoz } from "./common/signoz/init.js";
import { signoz } from "./common/signoz/index.js";

async function runSimpleTest() {
  console.log("🔍 Simple SignOz Test - Checking Span Transmission");
  console.log("==================================================\n");

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
      testType: 'simple',
    },
  });

  if (!signoz.isInitialized()) {
    console.log("❌ SignOz not initialized - check if SignOz is running");
    return;
  }

  console.log("✅ SignOz initialized successfully\n");

  // Test 1: Create a simple span with the exact attributes you mentioned
  console.log("1️⃣ Creating span with specific attributes");
  
  const span = signoz.startMcpSpan('test-span', {
    'test.attribute': 'test-value',
  });
  
  if (span) {
    console.log("   ✅ Span created successfully");
    
    // Add some events to make it more visible
    span.addEvent('test.started', {
      message: 'Test span created',
      testType: 'simple',
    });
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));
    
    span.addEvent('test.completed', {
      message: 'Test span finished',
      testType: 'simple',
    });
    
    // End the span
    span.setStatus({ code: 1 }); // OK status
    span.end();
    
    console.log("   ✅ Span ended with events");
  } else {
    console.log("   ❌ Failed to create span");
  }

  // Test 2: Use withSpan helper
  console.log("\n2️⃣ Testing withSpan helper");
  
  const result = await signoz.withSpan(
    'test-span',
    async () => {
      console.log("   ✅ Inside withSpan execution");
      await new Promise(resolve => setTimeout(resolve, 50));
      return { success: true, testValue: 'test-value' };
    },
    {
      'test.attribute': 'test-value',
      'test.method': 'withSpan',
    }
  );
  
  console.log(`   ✅ withSpan result: ${JSON.stringify(result)}`);

  // Test 3: Multiple spans with different names
  console.log("\n3️⃣ Creating multiple spans");
  
  for (let i = 0; i < 3; i++) {
    await signoz.withSpan(
      `test-span-${i}`,
      async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `test-${i}`;
      },
      {
        'test.attribute': 'test-value',
        'test.index': i,
        'test.batch': 'multiple',
      }
    );
    console.log(`   ✅ Created span test-span-${i}`);
  }

  // Wait for spans to be exported
  console.log("\n⏳ Waiting 3 seconds for spans to be exported to SignOz...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log("\n🎉 Simple Test Complete!");
  console.log("========================");
  console.log("📊 Check SignOz UI at: http://localhost:3301");
  console.log("🔍 Service Name: test-service");
  console.log("📝 Expected Spans:");
  console.log("   • test-span (with test.attribute: test-value)");
  console.log("   • test-span-0, test-span-1, test-span-2");
  console.log();
  console.log("💡 If you only see one span, check:");
  console.log("   1. SignOz is running at localhost:4318");
  console.log("   2. No firewall blocking the connection");
  console.log("   3. OpenTelemetry export interval settings");
}

// Run the test
runSimpleTest().catch(error => {
  console.error("❌ Simple test failed:", error);
  process.exit(1);
});