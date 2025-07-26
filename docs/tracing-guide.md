# MCP Server Tracing Guide

## Overview

The MCP Server implements distributed tracing using OpenTelemetry-compatible session tracking and trace context propagation. This enables comprehensive observability for request flows, performance monitoring, and debugging across the entire system.

## Trace ID Architecture

### Trace ID Format
- **Length**: 128-bit (32 hex characters)
- **Structure**: `{high64bits}{low64bits}`
- **Example**: `002c08b9d7041c1800044749c7bb5bb8`
- **Standard**: Compatible with W3C Trace Context specification

### Span ID Format  
- **Length**: 64-bit (16 hex characters)
- **Structure**: `{random64bits}`
- **Example**: `00b2deaa23f22b58`
- **Parent-Child**: Each operation creates a new span under parent trace

### Session ID Format
- **Structure**: `sess_{timestamp}_{random}`
- **Example**: `sess_1753546615332_hhais2xo9sp`
- **Persistence**: Lives for entire client connection duration

## Trace Context Propagation

### Automatic Trace Creation
Every MCP endpoint automatically creates traces:

```typescript
// Before
await logger.logEndpointEntry("tools/call", extra.requestId, params);

// After (with tracing)
const traceId = await logger.logEndpointEntry("tools/call", extra.requestId, params);
// ... operation logic ...
await logger.logMethodExit("tools/call", result, "tools", traceId);
```

### Manual Operation Tracing
For custom operations within endpoints:

```typescript
// Start custom operation trace
const operationTraceId = logger.startOperation("custom.validation", {
  'custom.input.size': inputData.length,
  'custom.complexity': 'high'
});

try {
  // ... validation logic ...
  
  logger.endOperation(operationTraceId, {
    'custom.result': 'success',
    'custom.items.processed': processedCount
  });
} catch (error) {
  logger.endOperation(operationTraceId, {
    'custom.result': 'error',
    'custom.error.type': error.name
  });
  throw error;
}
```

## Trace Attributes

### Standard MCP Attributes
All MCP operations include these standard attributes:

```typescript
interface McpTraceAttributes {
  // Operation identification
  'mcp.endpoint': string;           // "tools/call", "resources/read"
  'mcp.method': string;             // "tools/call"
  'mcp.request.id': string;         // Request identifier
  'mcp.session.id': string;         // Session identifier
  
  // Performance metrics
  'mcp.duration.ms': number;        // Total operation duration
  'mcp.response.time.ms'?: number;  // Response generation time
  'mcp.queue.time.ms'?: number;     // Time spent in queue
  
  // Request/response data
  'mcp.request.size'?: number;      // Request payload size
  'mcp.response.size'?: number;     // Response payload size
  'mcp.response.has_more'?: boolean;// Pagination indicator
  
  // Resource-specific
  'mcp.resource.uri'?: string;      // Resource URI
  'mcp.tool.name'?: string;         // Tool name
  'mcp.prompt.name'?: string;       // Prompt name
}
```

### Custom Attributes
Add domain-specific attributes for enhanced observability:

```typescript
// Performance tracking
const traceId = logger.startOperation("database.query", {
  'db.operation': 'SELECT',
  'db.table': 'users',
  'db.rows.limit': 100
});

// Business logic tracking  
const traceId = logger.startOperation("content.generation", {
  'content.type': 'code',
  'content.language': 'typescript',
  'content.complexity': 'medium'
});

// External API tracking
const traceId = logger.startOperation("external.api.call", {
  'http.method': 'POST',
  'http.url': 'https://api.example.com/data',
  'http.timeout.ms': 5000
});
```

## Session Context Integration

### Session Information in Logs
Every log entry automatically includes session context:

```json
{
  "message": "Operation completed",
  "_session": {
    "sessionId": "sess_1753546615332_hhais2xo9sp",
    "clientId": "web-client-123", 
    "connectionId": "conn_1753546615332_1zk21y9z",
    "transportType": "http"
  },
  "_trace": {
    "traceId": "002c08b9d7041c1800044749c7bb5bb8",
    "spanId": "00b2deaa23f22b58",
    "parentSpanId": "001a5c9d8e7f4b23",
    "operationName": "mcp.tools/call"
  },
  "_otel": {
    "timestamp": 1753546615333,
    "resource": {
      "service.name": "mcp-server",
      "service.version": "1.0.0"
    }
  }
}
```

### Session Lifecycle
```typescript
// 1. Session Creation (automatic for HTTP, manual for stdio)
const session = createSessionFromRequest(req);
logger.setSessionContext(session.sessionId);

// 2. Operation Tracing (automatic for endpoints)
const traceId = logger.startOperation("business.logic");

// 3. Nested Operations (manual)
const childTraceId = logger.startOperation("data.validation", {
  'validation.type': 'schema',
  'validation.strict': true
});

// 4. Session Cleanup (automatic on disconnect)
sessionManager.removeSession(session.sessionId);
```

## Endpoint Tracing Coverage

### Currently Implemented
✅ **Prompts**
- `prompts/list` - Full tracing with pagination metrics
- `prompts/get` - Full tracing with template resolution metrics

✅ **Ping** 
- `ping` - Response time and health metrics

✅ **Logging**
- `logging/setLevel` - Configuration change tracking
- `logging/config` - Feature toggle tracking

### Pending Implementation
⏳ **Resources**
- `resources/list` - Needs trace integration
- `resources/read` - Needs trace integration  
- `resources/subscribe` - Needs trace integration
- `resources/unsubscribe` - Needs trace integration

⏳ **Tools**
- `tools/list` - Needs implementation + tracing
- `tools/call` - Needs implementation + tracing

⏳ **Completion**
- `completion/complete` - Needs implementation + tracing

⏳ **Sampling**
- `sampling/createMessage` - Needs implementation + tracing

## Implementation Patterns

### Basic Endpoint Pattern
```typescript
export function registerMyEndpoint(server: McpServer) {
  server.server.setRequestHandler(MyRequestSchema, async (request, extra) => {
    // 1. Start tracing
    const traceId = await logger.logEndpointEntry("my/endpoint", extra.requestId, {
      paramCount: Object.keys(request.params || {}).length,
      // ... other relevant params
    });

    try {
      // 2. Main operation logic
      const result = await performOperation(request.params);
      
      // 3. End tracing with success metrics
      await logger.logMethodExit("my/endpoint", {
        requestId: extra.requestId,
        resultSize: JSON.stringify(result).length,
        // ... other metrics
      }, "my-category", traceId);

      return result;
    } catch (error) {
      // 4. End tracing with error (automatic via logger)
      await logger.logServerError(error, "my/endpoint", {
        requestId: extra.requestId,
        traceId
      });
      throw error;
    }
  });
}
```

### Complex Operation Pattern
```typescript
async function complexOperation(data: unknown[], traceId?: string | null) {
  // 1. Start nested operation
  const operationTraceId = logger.startOperation("complex.processing", {
    'input.count': data.length,
    'processing.mode': 'batch'
  });

  try {
    // 2. Multiple processing steps
    const validated = await validateData(data);
    logger.info({ message: "Data validated", count: validated.length });
    
    const processed = await processData(validated);
    logger.info({ message: "Data processed", count: processed.length });
    
    const enriched = await enrichData(processed);
    
    // 3. End with success metrics
    logger.endOperation(operationTraceId, {
      'processing.result': 'success',
      'output.count': enriched.length,
      'processing.efficiency': enriched.length / data.length
    });
    
    return enriched;
  } catch (error) {
    // 4. End with error info
    logger.endOperation(operationTraceId, {
      'processing.result': 'error',
      'error.stage': getCurrentStage(),
      'error.type': error.name
    });
    throw error;
  }
}
```

## HTTP Integration

### Trace Context Headers
Supports W3C Trace Context standard for distributed tracing:

```typescript
// Incoming request with trace context
const headers = {
  'traceparent': '00-002c08b9d7041c1800044749c7bb5bb8-00b2deaa23f22b58-01'
};

// Extract parent trace context
const parentContext = extractTraceContextFromHeaders(headers);

// Create child span
const childTraceId = logger.startOperation("mcp.request", {
  'parent.trace.id': parentContext.traceId,
  'parent.span.id': parentContext.spanId
});
```

### Express Middleware Integration
```typescript
app.use((req, res, next) => {
  // 1. Extract or create session
  const session = createSessionFromRequest(req);
  logger.setSessionContext(session.sessionId);
  
  // 2. Extract parent trace context
  const parentContext = extractTraceContextFromHeaders(req.headers);
  
  // 3. Start request trace
  const traceId = logger.startOperation("http.request", {
    'http.method': req.method,
    'http.url': req.url,
    'http.user_agent': req.headers['user-agent'],
    ...parentContext
  });
  
  // 4. Store trace ID for response
  res.locals.traceId = traceId;
  
  // 5. Inject trace context into response
  injectTraceContextIntoHeaders(res.getHeaders(), {
    traceId: traceId || generateTraceId(),
    spanId: generateSpanId()
  });
  
  next();
});
```

## Performance Considerations

### Trace Storage
- **Memory Usage**: ~200 bytes per active trace
- **Cleanup**: Automatic cleanup when traces end
- **Limits**: No hard limits, but monitor memory usage

### Performance Impact
- **Trace Creation**: ~0.1ms overhead
- **Logging Enhancement**: ~0.05ms per log entry  
- **Session Lookup**: ~0.01ms per operation
- **Total Overhead**: <1% for typical workloads

### Optimization Tips
```typescript
// 1. Disable tracing for high-frequency, low-value operations
if (!isImportantOperation(operationType)) {
  logger.setOTelSession(false);
}

// 2. Use sampling for high-volume scenarios
const shouldTrace = Math.random() < 0.1; // 10% sampling
if (shouldTrace) {
  const traceId = logger.startOperation("high.volume.operation");
}

// 3. Batch related operations under single trace
const batchTraceId = logger.startOperation("batch.processing");
for (const item of items) {
  await processItem(item); // Don't create individual traces
}
logger.endOperation(batchTraceId);
```

## Debugging and Monitoring

### Trace Statistics
```typescript
// Get current tracing statistics
const stats = logger.getOTelStats();
console.log(`Active traces: ${stats.sessionStats.activeTraces}`);
console.log(`Active sessions: ${stats.sessionStats.activeSessions}`);

// Session details
stats.sessionStats.sessions.forEach(session => {
  console.log(`Session ${session.sessionId}: ${session.uptime}ms uptime`);
});
```

### Trace Correlation
```bash
# Search logs by trace ID
grep "002c08b9d7041c18" server.log | jq '._trace'

# Find all operations in a session
grep "sess_1753546615332" server.log | jq '.message'

# Monitor trace duration
grep "mcp.duration.ms" server.log | jq '._trace.attributes."mcp.duration.ms"'
```

### Common Debugging Scenarios

#### Long Request Investigation
```typescript
// 1. Find slow traces
const slowTraces = logs.filter(log => 
  log._trace?.attributes?.['mcp.duration.ms'] > 1000
);

// 2. Analyze trace hierarchy
const traceTree = buildTraceTree(slowTraces[0]._trace.traceId);

// 3. Identify bottlenecks
const bottlenecks = traceTree.filter(span => 
  span.duration > traceTree.totalDuration * 0.3
);
```

#### Error Correlation
```typescript
// Find all related traces for an error
const errorTraceId = errorLog._trace.traceId;
const relatedLogs = logs.filter(log => 
  log._trace?.traceId === errorTraceId ||
  log._trace?.parentSpanId === errorLog._trace.spanId
);
```

## Best Practices

### Naming Conventions
```typescript
// ✅ Good - Hierarchical, descriptive
"mcp.tools.call"
"mcp.resources.read"  
"custom.validation.schema"
"external.api.call"

// ❌ Avoid - Generic, unclear
"operation"
"process"
"handle"
```

### Attribute Guidelines
```typescript
// ✅ Good - Structured, searchable
{
  'mcp.tool.name': 'calculator',
  'mcp.tool.operation': 'add',
  'mcp.tool.args.count': 2,
  'mcp.duration.ms': 45
}

// ❌ Avoid - Unstructured, hard to query
{
  'info': 'calculator add with 2 args took 45ms'
}
```

### Error Handling
```typescript
// ✅ Good - Preserve trace context in errors
try {
  await operation();
} catch (error) {
  logger.endOperation(traceId, {
    'result': 'error',
    'error.type': error.constructor.name,
    'error.recoverable': isRecoverable(error)
  });
  throw error;
}

// ❌ Avoid - Losing trace context
try {
  await operation();
} catch (error) {
  logger.error("Operation failed");
  throw error;
}
```

This tracing system provides comprehensive observability while maintaining excellent performance and ease of use. All traces are automatically correlated with sessions and include rich metadata for debugging and monitoring.