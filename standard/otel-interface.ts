/**
 * OpenTelemetry Interface for MCP Server Logging
 *
 * Provides OpenTelemetry-compliant observability interfaces that can be
 * integrated with existing logging system for distributed tracing,
 * metrics collection, and structured logging.
 */

// OpenTelemetry semantic conventions
export interface OTelSemconv {
  // Service attributes
  SERVICE_NAME: string;
  SERVICE_VERSION: string;
  SERVICE_INSTANCE_ID: string;

  // HTTP attributes
  HTTP_METHOD: string;
  HTTP_URL: string;
  HTTP_STATUS_CODE: string;
  HTTP_USER_AGENT: string;

  // RPC attributes (for MCP JSON-RPC)
  RPC_METHOD: string;
  RPC_SERVICE: string;
  RPC_SYSTEM: string;

  // Error attributes
  ERROR_TYPE: string;
  ERROR_MESSAGE: string;

  // Custom MCP attributes
  MCP_ENDPOINT: string;
  MCP_REQUEST_ID: string;
  MCP_CLIENT_ID: string;
}

// Trace context for distributed tracing
export interface OTelTraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: number;
  traceState?: string;
}

// Span interface for tracing operations
export interface OTelSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "ok" | "error" | "timeout";
  tags: Record<string, string | number | boolean>;
  logs: OTelLog[];
}

// Metric interface for performance monitoring
export interface OTelMetric {
  name: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  value: number;
  timestamp: number;
  labels: Record<string, string>;
  unit?: string;
  description?: string;
}

// Log interface with OTel structure
export interface OTelLog {
  timestamp: number;
  severityText: string;
  severityNumber: number;
  body: string | Record<string, unknown>;
  resource: OTelResource;
  attributes: Record<string, string | number | boolean>;
  traceId?: string;
  spanId?: string;
  traceFlags?: number;
}

// Resource interface for service identification
export interface OTelResource {
  "service.name": string;
  "service.version": string;
  "service.instance.id": string;
  "telemetry.sdk.name": string;
  "telemetry.sdk.language": string;
  "telemetry.sdk.version": string;
  [key: string]: string | number | boolean;
}

// Instrumentation scope for telemetry data
export interface OTelInstrumentationScope {
  name: string;
  version?: string;
  schemaUrl?: string;
  attributes?: Record<string, string | number | boolean>;
}

// Complete telemetry data structure
export interface OTelTelemetryData {
  resource: OTelResource;
  instrumentationScope: OTelInstrumentationScope;
  spans?: OTelSpan[];
  metrics?: OTelMetric[];
  logs?: OTelLog[];
}

// Tracer interface for creating spans
export interface OTelTracer {
  startSpan(name: string, options?: OTelSpanOptions): OTelSpan;
  activeSpan(): OTelSpan | null;
  withSpan<T>(span: OTelSpan, fn: () => T): T;
}

// Span creation options
export interface OTelSpanOptions {
  parent?: OTelSpan | OTelTraceContext;
  kind?: "internal" | "server" | "client" | "producer" | "consumer";
  attributes?: Record<string, string | number | boolean>;
  links?: OTelSpanLink[];
  startTime?: number;
}

// Span link for connecting related spans
export interface OTelSpanLink {
  traceId: string;
  spanId: string;
  attributes?: Record<string, string | number | boolean>;
}

// Meter interface for metrics collection
export interface OTelMeter {
  createCounter(name: string, options?: OTelInstrumentOptions): OTelCounter;
  createGauge(name: string, options?: OTelInstrumentOptions): OTelGauge;
  createHistogram(name: string, options?: OTelInstrumentOptions): OTelHistogram;
}

// Instrument creation options
export interface OTelInstrumentOptions {
  description?: string;
  unit?: string;
  valueType?: "int" | "double";
}

// Counter instrument for incrementing metrics
export interface OTelCounter {
  add(value: number, labels?: Record<string, string>): void;
}

// Gauge instrument for current value metrics
export interface OTelGauge {
  set(value: number, labels?: Record<string, string>): void;
}

// Histogram instrument for distribution metrics
export interface OTelHistogram {
  record(value: number, labels?: Record<string, string>): void;
}

// Logger interface with OTel integration
export interface OTelLogger {
  emit(logRecord: OTelLogRecord): void;
}

// Log record for structured logging
export interface OTelLogRecord {
  timestamp?: number;
  observedTimestamp?: number;
  severityText?: string;
  severityNumber?: number;
  body?: string | Record<string, unknown>;
  attributes?: Record<string, string | number | boolean>;
  resource?: OTelResource;
  instrumentationScope?: OTelInstrumentationScope;
}

// Context interface for trace/span propagation
export interface OTelContext {
  getValue(key: string): unknown;
  setValue(key: string, value: unknown): OTelContext;
  deleteValue(key: string): OTelContext;
}

// Propagator interface for context injection/extraction
export interface OTelPropagator {
  inject(context: OTelContext, carrier: Record<string, string>): void;
  extract(context: OTelContext, carrier: Record<string, string>): OTelContext;
  fields(): string[];
}

// Exporter interface for sending telemetry data
export interface OTelExporter<T> {
  export(items: T[]): Promise<void>;
  shutdown(): Promise<void>;
}

// Provider interfaces for telemetry components
export interface OTelTracerProvider {
  getTracer(name: string, version?: string): OTelTracer;
  addSpanProcessor(processor: OTelSpanProcessor): void;
  shutdown(): Promise<void>;
}

export interface OTelMeterProvider {
  getMeter(name: string, version?: string): OTelMeter;
  shutdown(): Promise<void>;
}

export interface OTelLoggerProvider {
  getLogger(name: string, version?: string): OTelLogger;
  addLogRecordProcessor(processor: OTelLogRecordProcessor): void;
  shutdown(): Promise<void>;
}

// Processor interfaces for telemetry data
export interface OTelSpanProcessor {
  onStart(span: OTelSpan): void;
  onEnd(span: OTelSpan): void;
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

export interface OTelLogRecordProcessor {
  onEmit(logRecord: OTelLogRecord): void;
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

// Sampler interface for trace sampling decisions
export interface OTelSampler {
  shouldSample(context: OTelContext, traceId: string, spanName: string): OTelSamplingResult;
}

export interface OTelSamplingResult {
  decision: "NOT_RECORD" | "RECORD" | "RECORD_AND_SAMPLE";
  attributes?: Record<string, string | number | boolean>;
}

// Configuration interfaces
export interface OTelSDKConfig {
  resource?: OTelResource;
  tracerProvider?: OTelTracerProviderConfig;
  meterProvider?: OTelMeterProviderConfig;
  loggerProvider?: OTelLoggerProviderConfig;
  propagators?: OTelPropagator[];
}

export interface OTelTracerProviderConfig {
  processors?: OTelSpanProcessor[];
  sampler?: OTelSampler;
  resource?: OTelResource;
}

export interface OTelMeterProviderConfig {
  readers?: OTelMetricReader[];
  resource?: OTelResource;
}

export interface OTelLoggerProviderConfig {
  processors?: OTelLogRecordProcessor[];
  resource?: OTelResource;
}

export interface OTelMetricReader {
  collect(): Promise<OTelMetric[]>;
  shutdown(): Promise<void>;
}

// MCP-specific OTel extensions
export interface McpOTelAttributes {
  // MCP protocol attributes
  "mcp.version": string;
  "mcp.endpoint": string;
  "mcp.method": string;
  "mcp.request.id": string;
  "mcp.client.id"?: string;
  "mcp.server.name": string;
  "mcp.transport.type": "stdio" | "http" | "websocket";

  // Request/response attributes
  "mcp.request.size"?: number;
  "mcp.response.size"?: number;
  "mcp.request.cursor"?: string;
  "mcp.response.has_more"?: boolean;

  // Tool/resource specific
  "mcp.tool.name"?: string;
  "mcp.resource.uri"?: string;
  "mcp.prompt.name"?: string;

  // Performance attributes
  "mcp.duration.ms": number;
  "mcp.queue.time.ms"?: number;
  "mcp.processing.time.ms"?: number;
}

// MCP-specific metric names
export interface McpOTelMetrics {
  // Request metrics
  MCP_REQUESTS_TOTAL: "mcp.requests.total";
  MCP_REQUEST_DURATION: "mcp.request.duration";
  MCP_REQUEST_SIZE: "mcp.request.size";
  MCP_RESPONSE_SIZE: "mcp.response.size";

  // Error metrics
  MCP_ERRORS_TOTAL: "mcp.errors.total";
  MCP_ERROR_RATE: "mcp.error.rate";

  // Resource metrics
  MCP_ACTIVE_CONNECTIONS: "mcp.connections.active";
  MCP_CONNECTION_DURATION: "mcp.connection.duration";

  // Performance metrics
  MCP_QUEUE_SIZE: "mcp.queue.size";
  MCP_PROCESSING_TIME: "mcp.processing.time";
  MCP_MEMORY_USAGE: "mcp.memory.usage";

  // Tool metrics
  MCP_TOOL_CALLS_TOTAL: "mcp.tool.calls.total";
  MCP_TOOL_DURATION: "mcp.tool.duration";
  MCP_TOOL_ERRORS: "mcp.tool.errors";

  // Resource metrics
  MCP_RESOURCE_READS_TOTAL: "mcp.resource.reads.total";
  MCP_RESOURCE_READ_DURATION: "mcp.resource.read.duration";
  MCP_RESOURCE_SIZE: "mcp.resource.size";
}

// MCP-specific span names
export interface McpOTelSpanNames {
  MCP_REQUEST: "mcp.request";
  MCP_TOOL_CALL: "mcp.tool.call";
  MCP_RESOURCE_READ: "mcp.resource.read";
  MCP_PROMPT_GET: "mcp.prompt.get";
  MCP_COMPLETION: "mcp.completion";
  MCP_SAMPLING: "mcp.sampling";
  MCP_LIFECYCLE: "mcp.lifecycle";
  MCP_TRANSPORT: "mcp.transport";
  MCP_AUTH: "mcp.auth";
}

// Integration interface for existing logger
export interface OTelLoggerIntegration {
  // Convert existing log to OTel format
  convertToOTelLog(
    level: string,
    message: string | Record<string, unknown>,
    logger: string,
    traceContext?: OTelTraceContext
  ): OTelLog;

  // Create span for operation
  createOperationSpan(
    operation: string,
    attributes?: Record<string, string | number | boolean>
  ): OTelSpan;

  // Record metric
  recordMetric(
    name: string,
    value: number,
    type: "counter" | "gauge" | "histogram",
    labels?: Record<string, string>
  ): void;

  // Extract trace context from headers
  extractTraceContext(headers: Record<string, string>): OTelTraceContext | null;

  // Inject trace context into headers
  injectTraceContext(context: OTelTraceContext, headers: Record<string, string>): void;
}

// Factory interface for creating OTel components
export interface OTelFactory {
  createTracer(name: string, version?: string): OTelTracer;
  createMeter(name: string, version?: string): OTelMeter;
  createLogger(name: string, version?: string): OTelLogger;
  createResource(attributes: Record<string, string>): OTelResource;
}

// Default resource attributes for MCP server
export const MCP_OTEL_RESOURCE_DEFAULTS: OTelResource = {
  "service.name": "mcp-server",
  "service.version": "1.0.0",
  "service.instance.id": process.env.HOSTNAME || "localhost",
  "telemetry.sdk.name": "opentelemetry",
  "telemetry.sdk.language": "typescript",
  "telemetry.sdk.version": "1.0.0",
  "mcp.transport.type": "stdio",
  "mcp.protocol.version": "2024-11-05",
};

// Default instrumentation scope
export const MCP_OTEL_INSTRUMENTATION_SCOPE: OTelInstrumentationScope = {
  name: "@mcp/server-instrumentation",
  version: "1.0.0",
  schemaUrl: "https://opentelemetry.io/schemas/1.21.0",
};
