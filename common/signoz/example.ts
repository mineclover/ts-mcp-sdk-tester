/**
 * SigNoz Integration Example
 * Example of how to use SigNoz integration in MCP Server
 */

import { SpanStatusCode } from '@opentelemetry/api';
import { signoz } from './index.js';
import { 
  traceMcpEndpoint,
  traceToolExecution,
  traceResourceOperation,
  addSessionContext,
  recordBusinessEvent,
  measureDuration,
  incrementCounter,
} from './helpers.js';
import { initializeSigNoz } from './init.js';

/**
 * Example 1: Basic span creation for MCP operation
 */
async function exampleBasicSpan() {
  // Start a span for an MCP operation
  const span = signoz.startMcpSpan('example.operation', {
    'example.type': 'basic',
    'example.user': 'demo-user',
  });
  
  if (!span) {
    console.log('SigNoz not initialized, skipping tracing');
    return;
  }
  
  try {
    // Add events during operation
    span.addEvent('operation.step1.started');
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    span.addEvent('operation.step1.completed', {
      items_processed: 10,
    });
    
    // Add more attributes as operation progresses
    span.setAttribute('example.result_count', 42);
    
    // Mark as successful
    span.setStatus({ code: SpanStatusCode.OK });
    
  } catch (error) {
    // Record error
    span.setStatus({ 
      code: SpanStatusCode.ERROR, 
      message: error instanceof Error ? error.message : String(error)
    });
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    // Always end the span
    span.end();
  }
}

/**
 * Example 2: Using withSpan helper for automatic span management
 */
async function exampleWithSpan() {
  const result = await signoz.withSpan(
    'example.auto_span',
    async (span) => {
      // Span is automatically managed
      span.setAttribute('example.type', 'automatic');
      
      // Add events
      span.addEvent('processing.started');
      
      // Do some work
      const data = await fetchSomeData();
      
      span.addEvent('processing.completed', {
        data_size: data.length,
      });
      
      return data;
    },
    {
      'example.method': 'withSpan',
    }
  );
  
  return result;
}

/**
 * Example 3: Tracing MCP endpoints
 */
async function exampleMcpEndpointTracing() {
  // Trace a tools/list endpoint
  const tools = await traceMcpEndpoint(
    'tools/list',
    'req-12345',
    async () => {
      // Simulate fetching tools
      return [
        { name: 'calculator', description: 'Basic calculator' },
        { name: 'weather', description: 'Weather information' },
      ];
    },
    {
      'client.id': 'example-client',
      'request.page_size': 10,
    }
  );
  
  return tools;
}

/**
 * Example 4: Tracing tool execution
 */
async function exampleToolExecution() {
  const result = await traceToolExecution(
    'calculator',
    { operation: 'add', a: 5, b: 3 },
    async () => {
      // Simulate tool execution
      await new Promise(resolve => setTimeout(resolve, 50));
      return { result: 8 };
    }
  );
  
  return result;
}

/**
 * Example 5: Nested spans for complex operations
 */
async function exampleNestedSpans() {
  await signoz.withSpan('example.parent_operation', async (parentSpan) => {
    parentSpan.setAttribute('operation.type', 'complex');
    
    // First child operation
    await signoz.withSpan('example.child_operation_1', async (childSpan) => {
      childSpan.setAttribute('child.index', 1);
      await new Promise(resolve => setTimeout(resolve, 30));
    });
    
    // Second child operation
    await signoz.withSpan('example.child_operation_2', async (childSpan) => {
      childSpan.setAttribute('child.index', 2);
      await new Promise(resolve => setTimeout(resolve, 40));
    });
    
    // Add parent-level event
    parentSpan.addEvent('all_children_completed');
  });
}

/**
 * Example 6: Recording metrics
 */
async function exampleMetrics() {
  // Record a request
  signoz.recordMcpRequest('example/endpoint', 'success', 125, {
    client_type: 'test',
  });
  
  // Record tool execution
  signoz.recordToolExecution('example_tool', 'success', 75);
  
  // Record session metrics
  signoz.recordSessionMetrics('created', 'http');
  
  // Simulate session duration
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  signoz.recordSessionMetrics('terminated', 'http', 1000);
  
  // Record an error
  signoz.recordError('ValidationError', -32602, 'example/endpoint');
  
  // Use helper functions for custom metrics
  incrementCounter('example.custom_counter', 1, { type: 'demo' });
  
  await measureDuration('example.operation_duration', async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
  }, { operation: 'demo' });
}

/**
 * Example 7: Adding session context
 */
async function exampleSessionContext() {
  await signoz.withSpan('example.session_operation', async (span) => {
    // Add session context to current span
    addSessionContext('sess_123456', 'client_789', 'http');
    
    // Record business events
    recordBusinessEvent('user.action', {
      action: 'button_clicked',
      button_id: 'submit',
    });
    
    // Do some work
    await new Promise(resolve => setTimeout(resolve, 50));
    
    recordBusinessEvent('operation.completed', {
      status: 'success',
      items_processed: 5,
    });
  });
}

/**
 * Simulate some async data fetching
 */
async function fetchSomeData(): Promise<any[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return Array(10).fill({ id: Math.random(), value: 'data' });
}

/**
 * Main example runner
 */
async function runExamples() {
  console.log('🚀 Starting SigNoz Integration Examples\n');
  
  // Initialize SigNoz with example configuration
  try {
    await initializeSigNoz({
      endpoint: 'http://localhost:4318',
      serviceName: 'mcp-server-example',
      serviceVersion: '1.0.0',
      environment: 'development',
      features: {
        traces: true,
        metrics: true,
        logs: false,
      },
    });
    
    console.log('✅ SigNoz initialized successfully\n');
  } catch (error) {
    console.error('❌ Failed to initialize SigNoz:', error);
    console.log('Continuing without tracing...\n');
  }
  
  // Run examples
  try {
    console.log('📊 Example 1: Basic span creation');
    await exampleBasicSpan();
    console.log('✅ Completed\n');
    
    console.log('📊 Example 2: Using withSpan helper');
    const data = await exampleWithSpan();
    console.log(`✅ Completed, fetched ${data.length} items\n`);
    
    console.log('📊 Example 3: MCP endpoint tracing');
    const tools = await exampleMcpEndpointTracing();
    console.log(`✅ Completed, found ${tools.length} tools\n`);
    
    console.log('📊 Example 4: Tool execution tracing');
    const result = await exampleToolExecution();
    console.log(`✅ Completed, result: ${JSON.stringify(result)}\n`);
    
    console.log('📊 Example 5: Nested spans');
    await exampleNestedSpans();
    console.log('✅ Completed\n');
    
    console.log('📊 Example 6: Recording metrics');
    await exampleMetrics();
    console.log('✅ Completed\n');
    
    console.log('📊 Example 7: Session context');
    await exampleSessionContext();
    console.log('✅ Completed\n');
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
  
  // Shutdown SigNoz
  if (signoz.isInitialized()) {
    console.log('🔚 Shutting down SigNoz...');
    await signoz.shutdown();
    console.log('✅ SigNoz shutdown complete');
  }
  
  console.log('\n🎉 All examples completed!');
  console.log('Check your SigNoz dashboard at http://localhost:3301 to see the traces and metrics');
}

// Run examples if this is the main module
if (import.meta.main) {
  runExamples().catch(console.error);
}

// Export for use in other modules
export { runExamples };