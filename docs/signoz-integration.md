# SigNoz Integration Guide for MCP Server

This guide explains how to integrate SigNoz observability with the MCP Server for distributed tracing, metrics collection, and performance monitoring.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup and Configuration](#setup-and-configuration)
4. [Usage Examples](#usage-examples)
5. [API Reference](#api-reference)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Overview

The SigNoz integration provides comprehensive observability for MCP servers through:

- **Distributed Tracing**: Track requests across the entire MCP lifecycle
- **Metrics Collection**: Monitor performance, errors, and business KPIs
- **Session Correlation**: Link traces with MCP sessions
- **Auto-instrumentation**: Automatic tracing for HTTP, tools, resources, and more

### Key Features

- 🔍 **Full Request Lifecycle Tracing**: From transport layer to endpoint execution
- 📊 **Rich Metrics**: Request rates, latencies, error rates, session durations
- 🔗 **Session Correlation**: Associate traces with MCP sessions and clients
- 🎯 **Business Events**: Track custom events and KPIs
- 🚀 **Low Overhead**: Efficient sampling and batching
- 🔧 **Easy Integration**: Simple API with helper functions

## Architecture

### Components

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   MCP Server    │────▶│ OTel Provider │────▶│   SigNoz    │
└─────────────────┘     └──────────────┘     └─────────────┘
        │                       │                     │
        ├── Traces ────────────▶├── OTLP/HTTP ──────▶│
        ├── Metrics ───────────▶├── Batching ───────▶│
        └── Context ───────────▶└── Compression ────▶│
```

### Directory Structure

```
common/
├── otel/                    # OpenTelemetry specifications
│   ├── types.ts            # OTel type definitions
│   ├── provider.ts         # OTel provider implementation
│   └── index.ts           # OTel exports
└── signoz/                 # SigNoz integration
    ├── config.ts          # SigNoz configuration
    ├── index.ts           # Main integration
    ├── helpers.ts         # Helper functions
    ├── init.ts            # Initialization module
    └── example.ts         # Usage examples
```

## Setup and Configuration

### 1. Install Dependencies

```bash
bun install
```

The following packages are required (already in package.json):
- `@opentelemetry/api`
- `@opentelemetry/sdk-node`
- `@opentelemetry/exporter-trace-otlp-http`
- `@opentelemetry/exporter-metrics-otlp-http`
- And other OTel packages

### 2. Environment Configuration

Create a `.env` file or set environment variables:

```bash
# Basic Configuration
SIGNOZ_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=mcp-server
OTEL_SERVICE_VERSION=1.0.0
NODE_ENV=development

# Optional Configuration
SIGNOZ_API_KEY=your-api-key          # For SigNoz Cloud
SIGNOZ_TRACES_ENABLED=true           # Enable tracing (default: true)
SIGNOZ_METRICS_ENABLED=true          # Enable metrics (default: true)
SIGNOZ_LOGS_ENABLED=false            # Enable logs (default: false)
SIGNOZ_COMPRESSION=gzip              # Compression type (default: gzip)
SIGNOZ_TIMEOUT=10000                 # Export timeout in ms (default: 10000)
SIGNOZ_CUSTOM_ATTRIBUTES={"team":"mcp","region":"us-east"}
```

### 3. Initialize in Your MCP Server

#### Option 1: Automatic Initialization

```typescript
import { conditionalInitializeSigNoz } from './common/signoz/init.js';

// In your main server file
async function main() {
  // Initialize SigNoz if enabled
  await conditionalInitializeSigNoz();
  
  // Create and start your MCP server
  const server = await createServer();
  // ...
}
```

#### Option 2: Manual Initialization

```typescript
import { initializeSigNoz } from './common/signoz/init.js';

async function main() {
  // Initialize with custom config
  await initializeSigNoz({
    endpoint: 'http://localhost:4318',
    serviceName: 'my-mcp-server',
    serviceVersion: '2.0.0',
    environment: 'production',
    features: {
      traces: true,
      metrics: true,
      logs: false,
    },
    customAttributes: {
      team: 'backend',
      region: 'us-west',
    },
  });
  
  // Create and start your MCP server
  const server = await createServer();
  // ...
}
```

#### Option 3: Using Server Factory

```typescript
import { createSigNozEnabledServer } from './common/signoz/init.js';

const server = await createSigNozEnabledServer(
  async () => {
    // Your server creation logic
    return createMcpServer();
  },
  {
    endpoint: 'http://localhost:4318',
    serviceName: 'mcp-server',
    serviceVersion: '1.0.0',
  }
);
```

## Usage Examples

### Basic Span Creation

```typescript
import { signoz } from './common/signoz/index.js';

// Create a span manually
const span = signoz.startMcpSpan('my.operation', {
  'user.id': 'user123',
  'operation.type': 'custom',
});

try {
  // Your operation logic
  span?.addEvent('operation.started');
  
  // Add attributes
  span?.setAttribute('result.count', 42);
  
  // Success
  span?.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  // Record error
  span?.recordException(error);
  span?.setStatus({ code: SpanStatusCode.ERROR });
  throw error;
} finally {
  span?.end();
}
```

### Using Helper Functions

```typescript
import { 
  traceMcpEndpoint,
  traceToolExecution,
  addSessionContext,
  recordBusinessEvent,
} from './common/signoz/helpers.js';

// Trace an MCP endpoint
const result = await traceMcpEndpoint(
  'tools/list',
  requestId,
  async () => {
    // Your endpoint logic
    return getTools();
  },
  {
    'client.id': clientId,
    'page.size': 10,
  }
);

// Trace tool execution
const toolResult = await traceToolExecution(
  'calculator',
  { operation: 'add', a: 5, b: 3 },
  async () => {
    return calculator.add(5, 3);
  }
);

// Add session context to current span
addSessionContext(sessionId, clientId, 'http');

// Record business events
recordBusinessEvent('user.action', {
  action: 'tool_executed',
  tool: 'calculator',
  success: true,
});
```

### Recording Metrics

```typescript
import { signoz } from './common/signoz/index.js';
import { incrementCounter, measureDuration } from './common/signoz/helpers.js';

// Record MCP request metrics
signoz.recordMcpRequest(
  'tools/call',
  'success',
  125, // duration in ms
  {
    tool_name: 'calculator',
    client_type: 'vscode',
  }
);

// Record custom metrics
incrementCounter('custom.operations.count', 1, {
  operation: 'data_processing',
});

// Measure operation duration
const result = await measureDuration(
  'data.processing.duration',
  async () => {
    return processData();
  },
  {
    data_type: 'json',
    size: 'large',
  }
);

// Session metrics
signoz.recordSessionMetrics('created', 'http');
// ... later ...
signoz.recordSessionMetrics('terminated', 'http', sessionDuration);
```

### Integration with MCP Endpoints

```typescript
// In your endpoint handlers
server.server.setRequestHandler(
  ListToolsRequestSchema,
  async (request, extra) => {
    return traceMcpEndpoint(
      'tools/list',
      extra.requestId,
      async () => {
        // Your existing logic
        const tools = await getTools();
        return { tools };
      },
      {
        cursor: request.params?.cursor,
      }
    );
  }
);
```

### Express Middleware

```typescript
import { sigNozHttpMiddleware } from './common/signoz/index.js';

// Add to Express app
app.use(sigNozHttpMiddleware());
```

## API Reference

### Core Functions

#### `initializeSigNoz(config?: SigNozConfig)`
Initialize SigNoz integration with optional custom configuration.

#### `signoz.withSpan<T>(name, fn, attributes?)`
Execute a function within a traced span, automatically managing lifecycle.

#### `traceMcpEndpoint(endpoint, requestId, fn, attributes?)`
Trace an MCP endpoint execution with automatic metrics.

#### `traceToolExecution(toolName, args, fn)`
Trace a tool execution with specialized attributes.

#### `recordBusinessEvent(name, attributes?)`
Record a custom business event on the current span.

### Configuration Types

```typescript
interface SigNozConfig {
  endpoint: string;
  serviceName: string;
  serviceVersion: string;
  serviceNamespace?: string;
  environment?: 'development' | 'staging' | 'production';
  apiKey?: string;
  features?: {
    traces?: boolean;
    metrics?: boolean;
    logs?: boolean;
    profiling?: boolean;
  };
  insecure?: boolean;
  compression?: 'none' | 'gzip';
  timeout?: number;
  customAttributes?: Record<string, string | number | boolean>;
}
```

## Best Practices

### 1. Span Naming
- Use hierarchical names: `mcp.tools.call`, `mcp.resources.read`
- Be consistent across your application
- Include the operation type in the name

### 2. Attribute Usage
- Follow OpenTelemetry semantic conventions
- Add meaningful business context
- Avoid sensitive data (passwords, tokens)
- Use standard attribute names from `MCP_SPAN_ATTRIBUTES`

### 3. Error Handling
- Always record exceptions with `span.recordException()`
- Set appropriate span status
- Include error context in attributes

### 4. Performance
- Use sampling in production (configured automatically)
- Batch exports to reduce overhead
- Avoid creating too many spans for trivial operations

### 5. Session Correlation
- Always add session context when available
- Link transport traces with endpoint traces
- Use consistent session IDs across operations

## Troubleshooting

### SigNoz Not Receiving Data

1. **Check SigNoz is running**:
   ```bash
   curl http://localhost:4318/v1/traces
   ```

2. **Enable debug logging**:
   ```bash
   export OTEL_LOG_LEVEL=debug
   ```

3. **Verify configuration**:
   - Check endpoint URL is correct
   - Ensure no firewall blocking port 4318
   - Verify service name is valid

### Missing Traces

1. **Check initialization**:
   ```typescript
   if (signoz.isInitialized()) {
     console.log('SigNoz is initialized');
   }
   ```

2. **Verify span creation**:
   - Ensure spans are being created
   - Check span.end() is called
   - Verify no exceptions preventing span completion

### High Memory Usage

1. **Adjust batch size**:
   - Reduce export interval
   - Enable compression

2. **Implement sampling**:
   - Use trace ID ratio sampling
   - Implement custom sampling logic

### Common Errors

**"Failed to export spans"**
- Check network connectivity
- Verify SigNoz endpoint
- Check for proxy settings

**"Service not appearing in SigNoz"**
- Generate some traffic first
- Check service name is valid
- Verify traces are being sent

## Advanced Topics

### Custom Sampling

```typescript
const config: McpOTelConfig = {
  // ... other config
  sampling: {
    traceIdRatio: 0.1, // Sample 10% of traces
    parentBased: true, // Respect parent sampling decision
  },
};
```

### Multi-Environment Setup

```typescript
const config = {
  endpoint: process.env.SIGNOZ_ENDPOINT,
  environment: process.env.NODE_ENV,
  customAttributes: {
    deployment: process.env.DEPLOYMENT_ID,
    region: process.env.AWS_REGION,
    version: process.env.GIT_COMMIT,
  },
};
```

### Resource Detection

The integration automatically detects:
- Process information (PID, runtime)
- Host information (hostname, type)
- OS information (type, version)
- Environment variables

## Next Steps

1. **Set up SigNoz**: Follow the [SigNoz installation guide](https://signoz.io/docs/install/)
2. **Run examples**: Execute `bun run common/signoz/example.ts`
3. **View traces**: Open SigNoz UI at http://localhost:3301
4. **Create dashboards**: Build custom dashboards for your KPIs
5. **Set up alerts**: Configure alerts for errors and performance issues

## References

- [SigNoz Documentation](https://signoz.io/docs/)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/languages/js/getting-started/nodejs/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)