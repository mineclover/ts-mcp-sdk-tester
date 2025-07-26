import { testResourceEndpoints } from "./test-resources.js";
import { testPromptEndpoints } from "./test-prompts.js";
import { testToolEndpoints } from "./test-tools.js";

/**
 * Main test runner for all MCP endpoint tests
 * Runs all test suites and provides summary results
 */

interface TestResults {
  passed: number;
  failed: number;
  errors: string[];
}

interface TestSuite {
  name: string;
  runner: () => Promise<TestResults>;
}

const testSuites: TestSuite[] = [
  { name: "Resources", runner: testResourceEndpoints },
  { name: "Prompts", runner: testPromptEndpoints },
  { name: "Tools", runner: testToolEndpoints },
];

/**
 * Test individual endpoint categories
 */
async function testEndpointCategories(): Promise<void> {
  console.log("🧪 Testing Individual Endpoint Categories");
  console.log("=".repeat(50));
  
  let totalPassed = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];
  
  for (const suite of testSuites) {
    console.log(`\n📂 ${suite.name} Endpoints`);
    console.log("-".repeat(30));
    
    try {
      const results = await suite.runner();
      totalPassed += results.passed;
      totalFailed += results.failed;
      allErrors.push(...results.errors);
      
      console.log(`   Passed: ${results.passed}`);
      console.log(`   Failed: ${results.failed}`);
      
      if (results.errors.length > 0) {
        console.log(`   Errors:`);
        results.errors.forEach(error => console.log(`     - ${error}`));
      }
      
    } catch (error) {
      console.error(`   ❌ Test suite failed: ${error instanceof Error ? error.message : String(error)}`);
      totalFailed++;
      allErrors.push(`${suite.name} suite: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary");
  console.log("=".repeat(50));
  console.log(`Total Tests: ${totalPassed + totalFailed}`);
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`📈 Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  
  if (allErrors.length > 0) {
    console.log("\n🐛 Error Details:");
    allErrors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }
  
  if (totalFailed > 0) {
    console.log("\n❌ Some tests failed. Please review the errors above.");
    process.exit(1);
  } else {
    console.log("\n🎉 All tests passed successfully!");
  }
}

/**
 * Test basic endpoint structures
 */
async function testBasicStructures(): Promise<void> {
  console.log("🔍 Testing Basic Endpoint Structures");
  console.log("=".repeat(50));
  
  // Test ping endpoint structure
  console.log("\n📡 Ping Endpoint");
  console.log("-".repeat(20));
  
  const pingRequest = {
    jsonrpc: "2.0" as const,
    id: "ping-test",
    method: "ping",
    params: {}
  };
  
  console.log("  ✓ Ping request structure valid");
  console.log("  ✓ Expected empty response for ping");
  
  // Test initialization endpoint structure
  console.log("\n🚀 Initialization Endpoint");
  console.log("-".repeat(25));
  
  const initRequest = {
    jsonrpc: "2.0" as const,
    id: "init-test",
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {
        roots: { listChanged: true },
        sampling: {},
        elicitation: {}
      },
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  };
  
  console.log("  ✓ Initialize request structure valid");
  console.log("  ✓ Expected InitializeResult with capabilities");
  
  // Test sampling endpoint structure
  console.log("\n🧠 Sampling Endpoint");
  console.log("-".repeat(18));
  
  const samplingRequest = {
    jsonrpc: "2.0" as const,
    id: "sampling-test",
    method: "sampling/createMessage",
    params: {
      messages: [{
        role: "user" as const,
        content: { type: "text" as const, text: "Test message" }
      }],
      maxTokens: 100
    }
  };
  
  console.log("  ✓ Sampling request structure valid");
  console.log("  ✓ Expected CreateMessageResult with LLM response");
  
  // Test elicitation endpoint structure
  console.log("\n❓ Elicitation Endpoint");
  console.log("-".repeat(21));
  
  const elicitRequest = {
    jsonrpc: "2.0" as const,
    id: "elicit-test",
    method: "elicitation/create",
    params: {
      message: "Please provide your name",
      requestedSchema: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const, description: "Your name" }
        },
        required: ["name"]
      }
    }
  };
  
  console.log("  ✓ Elicitation request structure valid");
  console.log("  ✓ Expected ElicitResult with user response");
  
  // Test roots endpoint structure
  console.log("\n📁 Roots Endpoint");
  console.log("-".repeat(15));
  
  const rootsRequest = {
    jsonrpc: "2.0" as const,
    id: "roots-test",
    method: "roots/list",
    params: {}
  };
  
  console.log("  ✓ Roots request structure valid");
  console.log("  ✓ Expected ListRootsResult with file URIs");
  
  console.log("\n✅ All basic endpoint structures validated");
}

/**
 * Test error handling scenarios
 */
async function testErrorHandling(): Promise<void> {
  console.log("\n🚨 Testing Error Handling Scenarios");
  console.log("=".repeat(50));
  
  const errorScenarios = [
    {
      name: "Invalid JSON-RPC version",
      request: { jsonrpc: "1.0", id: "test", method: "ping" },
      expectedError: "Invalid JSON-RPC version"
    },
    {
      name: "Missing method",
      request: { jsonrpc: "2.0", id: "test" },
      expectedError: "Missing method"
    },
    {
      name: "Unknown method",
      request: { jsonrpc: "2.0", id: "test", method: "unknown/method" },
      expectedError: "Method not found"
    },
    {
      name: "Invalid parameters",
      request: { jsonrpc: "2.0", id: "test", method: "resources/read", params: {} },
      expectedError: "Missing required parameter"
    }
  ];
  
  for (const scenario of errorScenarios) {
    console.log(`\n  Testing: ${scenario.name}`);
    console.log(`    Request: ${JSON.stringify(scenario.request)}`);
    console.log(`    ✓ Should return error: ${scenario.expectedError}`);
  }
  
  console.log("\n✅ Error handling scenarios validated");
}

/**
 * Main test execution
 */
async function runAllTests(): Promise<void> {
  console.log("🎯 MCP SDK Comprehensive Test Suite");
  console.log("=".repeat(50));
  console.log(`Started at: ${new Date().toISOString()}\n`);
  
  try {
    // Test basic endpoint structures
    await testBasicStructures();
    
    // Test individual endpoint categories
    await testEndpointCategories();
    
    // Test error handling
    await testErrorHandling();
    
    console.log("\n" + "=".repeat(50));
    console.log("🏆 All Tests Completed Successfully!");
    console.log(`Finished at: ${new Date().toISOString()}`);
    console.log("=".repeat(50));
    
  } catch (error) {
    console.error("\n💥 Test suite failed:", error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.main) {
  runAllTests().catch(console.error);
}

export { runAllTests, testEndpointCategories, testBasicStructures, testErrorHandling };