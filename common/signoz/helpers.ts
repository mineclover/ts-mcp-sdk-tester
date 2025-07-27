/**
 * SigNoz Integration Helper Functions
 * Utility functions for easier SigNoz integration
 */

import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";
import type { Span, SpanContext } from "@opentelemetry/api";
import { signoz } from "./index.js";
import { MCP_SPAN_ATTRIBUTES, MCP_SPAN_NAMES } from "../otel/types.js";
import type { McpSpanAttributes } from "../otel/types.js";

/**
 * Trace an MCP endpoint call
 */
export async function traceMcpEndpoint<T>(
  endpointName: string,
  requestId: string | undefined,
  fn: () => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> {
  const spanName = MCP_SPAN_NAMES.ENDPOINT_CALL(endpointName);

  return signoz.withSpan(
    spanName,
    async (span) => {
      // Set standard MCP attributes
      span.setAttributes({
        [MCP_SPAN_ATTRIBUTES.MCP_ENDPOINT]: endpointName,
        [MCP_SPAN_ATTRIBUTES.MCP_REQUEST_ID]: requestId || "unknown",
        ...attributes,
      });

      // Add event for endpoint start
      span.addEvent("endpoint.started", {
        endpoint: endpointName,
      });

      const startTime = Date.now();

      try {
        const result = await fn();

        // Add success event
        span.addEvent("endpoint.completed", {
          endpoint: endpointName,
          duration_ms: Date.now() - startTime,
        });

        // Record metrics
        signoz.recordMcpRequest(endpointName, "success", Date.now() - startTime, {
          endpoint: endpointName,
        });

        return result;
      } catch (error) {
        // Add error event
        span.addEvent("endpoint.error", {
          endpoint: endpointName,
          error: error instanceof Error ? error.message : String(error),
        });

        // Record error metrics
        signoz.recordError(
          error instanceof Error ? error.name : "UnknownError",
          -32603, // Internal error code
          endpointName
        );

        signoz.recordMcpRequest(endpointName, "error", Date.now() - startTime, {
          endpoint: endpointName,
        });

        throw error;
      }
    },
    attributes
  );
}

/**
 * Trace a tool execution
 */
export async function traceToolExecution<T>(
  toolName: string,
  args: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const spanName = MCP_SPAN_NAMES.TOOL_CALL(toolName);

  return signoz.withSpan(
    spanName,
    async (span) => {
      // Set tool-specific attributes
      span.setAttributes({
        [MCP_SPAN_ATTRIBUTES.MCP_TOOL_NAME]: toolName,
        "tool.args_count": Object.keys(args).length,
      });

      // Add event for tool start
      span.addEvent("tool.execution.started", {
        tool: toolName,
        has_args: Object.keys(args).length > 0,
      });

      const startTime = Date.now();

      try {
        const result = await fn();
        const duration = Date.now() - startTime;

        // Add success event
        span.addEvent("tool.execution.completed", {
          tool: toolName,
          duration_ms: duration,
        });

        // Record metrics
        signoz.recordToolExecution(toolName, "success", duration);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Add error event
        span.addEvent("tool.execution.error", {
          tool: toolName,
          error: error instanceof Error ? error.message : String(error),
          duration_ms: duration,
        });

        // Record metrics
        signoz.recordToolExecution(toolName, "error", duration);

        throw error;
      }
    },
    {
      "tool.name": toolName,
      "tool.type": "mcp",
    }
  );
}

/**
 * Trace a resource operation
 */
export async function traceResourceOperation<T>(
  operation: "list" | "read" | "subscribe",
  resourceUri: string | undefined,
  fn: () => Promise<T>
): Promise<T> {
  const spanName =
    operation === "list"
      ? MCP_SPAN_NAMES.RESOURCE_LIST
      : operation === "read"
        ? MCP_SPAN_NAMES.RESOURCE_READ
        : MCP_SPAN_NAMES.RESOURCE_SUBSCRIBE;

  return signoz.withSpan(
    spanName,
    async (span) => {
      // Set resource-specific attributes
      const attrs: Record<string, unknown> = {
        "resource.operation": operation,
      };

      if (resourceUri) {
        attrs[MCP_SPAN_ATTRIBUTES.MCP_RESOURCE_URI] = resourceUri;
      }

      span.setAttributes(attrs);

      // Add event for operation start
      span.addEvent(`resource.${operation}.started`, {
        uri: resourceUri || "all",
      });

      const result = await fn();

      // Add success event
      span.addEvent(`resource.${operation}.completed`, {
        uri: resourceUri || "all",
      });

      return result;
    },
    {
      "resource.type": "mcp",
    }
  );
}

/**
 * Extract trace context from HTTP headers
 */
export function extractTraceContext(
  headers: Record<string, string | string[] | undefined>
): SpanContext | undefined {
  const traceparent = headers["traceparent"];
  if (!traceparent || Array.isArray(traceparent)) {
    return undefined;
  }

  // Parse W3C traceparent header
  // Format: version-trace_id-parent_id-trace_flags
  const parts = traceparent.split("-");
  if (parts.length !== 4) {
    return undefined;
  }

  const [version, traceId, spanId, traceFlags] = parts;

  return {
    traceId,
    spanId,
    traceFlags: parseInt(traceFlags, 16),
    isRemote: true,
  };
}

/**
 * Inject trace context into HTTP headers
 */
export function injectTraceContext(headers: Record<string, string>): Record<string, string> {
  const span = trace.getActiveSpan();
  if (!span) {
    return headers;
  }

  const spanContext = span.spanContext();
  if (!spanContext) {
    return headers;
  }

  // Create W3C traceparent header
  const traceparent = `00-${spanContext.traceId}-${spanContext.spanId}-${spanContext.traceFlags.toString(16).padStart(2, "0")}`;

  return {
    ...headers,
    traceparent,
  };
}

/**
 * Create a child span from parent context
 */
export function createChildSpan(
  name: string,
  parentContext?: SpanContext,
  attributes?: McpSpanAttributes
): Span | undefined {
  const tracer = signoz.getTracer();
  if (!tracer) {
    return undefined;
  }

  const options = {
    kind: SpanKind.INTERNAL,
    attributes,
  };

  if (parentContext) {
    // Create span with parent context
    const parentSpan = trace.wrapSpanContext(parentContext);
    return tracer.startSpan(name, {
      ...options,
      links: [{ context: parentContext }],
    });
  }

  return tracer.startSpan(name, options);
}

/**
 * Add session context to current span
 */
export function addSessionContext(
  sessionId: string,
  clientId?: string,
  transportType?: string
): void {
  const span = trace.getActiveSpan();
  if (!span) {
    return;
  }

  const attrs: Record<string, unknown> = {
    [MCP_SPAN_ATTRIBUTES.MCP_SESSION_ID]: sessionId,
  };

  if (clientId) {
    attrs[MCP_SPAN_ATTRIBUTES.MCP_CLIENT_ID] = clientId;
  }

  if (transportType) {
    attrs["session.transport_type"] = transportType;
  }

  span.setAttributes(attrs);
}

/**
 * Record a business event
 */
export function recordBusinessEvent(eventName: string, attributes?: Record<string, unknown>): void {
  const span = trace.getActiveSpan();
  if (!span) {
    return;
  }

  span.addEvent(eventName, {
    timestamp: Date.now(),
    ...attributes,
  });
}

/**
 * Measure async operation duration
 */
export async function measureDuration<T>(
  metricName: string,
  fn: () => Promise<T>,
  attributes?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await fn();
    const duration = Date.now() - startTime;

    // Record duration metric
    const meter = signoz.getMeter();
    if (meter) {
      const histogram = meter.createHistogram(metricName, {
        description: `Duration of ${metricName}`,
        unit: "ms",
      });

      histogram.record(duration, attributes);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Record duration metric even on error
    const meter = signoz.getMeter();
    if (meter) {
      const histogram = meter.createHistogram(metricName, {
        description: `Duration of ${metricName}`,
        unit: "ms",
      });

      histogram.record(duration, {
        ...attributes,
        error: true,
      });
    }

    throw error;
  }
}

/**
 * Create a simple counter metric
 */
export function incrementCounter(
  metricName: string,
  value: number = 1,
  attributes?: Record<string, unknown>
): void {
  const meter = signoz.getMeter();
  if (!meter) {
    return;
  }

  const counter = meter.createCounter(metricName, {
    description: `Counter for ${metricName}`,
  });

  counter.add(value, attributes);
}

/**
 * Update a gauge metric
 */
export function updateGauge(
  metricName: string,
  value: number,
  attributes?: Record<string, unknown>
): void {
  const meter = signoz.getMeter();
  if (!meter) {
    return;
  }

  const gauge = meter.createUpDownCounter(metricName, {
    description: `Gauge for ${metricName}`,
  });

  gauge.add(value, attributes);
}
