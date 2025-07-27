/**
 * OpenTelemetry Type Definitions for MCP Server
 * Core types and interfaces for OTel integration
 */

import type { Attributes, Span, SpanContext, SpanKind, SpanStatus } from '@opentelemetry/api';
import type { Resource } from '@opentelemetry/resources';

/**
 * MCP-specific OpenTelemetry configuration
 */
export interface McpOTelConfig {
  serviceName: string;
  serviceVersion: string;
  serviceNamespace?: string;
  deploymentEnvironment?: string;
  
  // Exporter configurations
  exporters: {
    traces?: OTelExporterConfig;
    metrics?: OTelExporterConfig;
    logs?: OTelExporterConfig;
  };
  
  // Sampling configuration
  sampling?: {
    alwaysOn?: boolean;
    alwaysOff?: boolean;
    traceIdRatio?: number;
    parentBased?: boolean;
  };
  
  // Resource attributes
  resourceAttributes?: Record<string, string | number | boolean>;
  
  // Feature flags
  features?: {
    autoInstrumentation?: boolean;
    manualSpans?: boolean;
    customMetrics?: boolean;
    contextPropagation?: boolean;
  };
}

/**
 * OTel Exporter Configuration
 */
export interface OTelExporterConfig {
  type: 'otlp-http' | 'otlp-grpc' | 'console' | 'jaeger' | 'zipkin';
  endpoint?: string;
  headers?: Record<string, string>;
  timeout?: number;
  compression?: 'none' | 'gzip';
  insecure?: boolean;
}

/**
 * MCP Span Attributes
 */
export interface McpSpanAttributes extends Attributes {
  'mcp.operation.type': 'endpoint' | 'tool' | 'resource' | 'prompt' | 'transport';
  'mcp.operation.name': string;
  'mcp.session.id'?: string;
  'mcp.request.id'?: string;
  'mcp.client.id'?: string;
  'mcp.protocol.version'?: string;
  'mcp.transport.type'?: 'stdio' | 'http' | 'websocket';
}

/**
 * MCP Trace Context
 */
export interface McpTraceContext extends SpanContext {
  sessionId?: string;
  clientId?: string;
  transportType?: string;
}

/**
 * MCP Span Event
 */
export interface McpSpanEvent {
  name: string;
  attributes?: Attributes;
  timestamp?: number;
}

/**
 * MCP Metric Types
 */
export type McpMetricType = 
  | 'counter'
  | 'histogram'
  | 'gauge'
  | 'up_down_counter'
  | 'observable_counter'
  | 'observable_gauge'
  | 'observable_up_down_counter';

/**
 * MCP Metric Definition
 */
export interface McpMetricDefinition {
  name: string;
  type: McpMetricType;
  description: string;
  unit?: string;
  valueType?: 'int' | 'double';
  attributes?: string[];
}

/**
 * Standard MCP Metrics
 */
export const MCP_STANDARD_METRICS: Record<string, McpMetricDefinition> = {
  // Request metrics
  'mcp.request.count': {
    name: 'mcp.request.count',
    type: 'counter',
    description: 'Total number of MCP requests',
    attributes: ['method', 'status', 'transport_type'],
  },
  'mcp.request.duration': {
    name: 'mcp.request.duration',
    type: 'histogram',
    description: 'MCP request duration',
    unit: 'ms',
    attributes: ['method', 'status', 'transport_type'],
  },
  
  // Session metrics
  'mcp.session.active': {
    name: 'mcp.session.active',
    type: 'up_down_counter',
    description: 'Number of active MCP sessions',
    attributes: ['transport_type', 'client_type'],
  },
  'mcp.session.duration': {
    name: 'mcp.session.duration',
    type: 'histogram',
    description: 'MCP session duration',
    unit: 'ms',
    attributes: ['transport_type', 'client_type', 'termination_reason'],
  },
  
  // Tool metrics
  'mcp.tool.execution.count': {
    name: 'mcp.tool.execution.count',
    type: 'counter',
    description: 'Number of tool executions',
    attributes: ['tool_name', 'status'],
  },
  'mcp.tool.execution.duration': {
    name: 'mcp.tool.execution.duration',
    type: 'histogram',
    description: 'Tool execution duration',
    unit: 'ms',
    attributes: ['tool_name', 'status'],
  },
  
  // Resource metrics
  'mcp.resource.access.count': {
    name: 'mcp.resource.access.count',
    type: 'counter',
    description: 'Number of resource accesses',
    attributes: ['resource_uri', 'method'],
  },
  
  // Error metrics
  'mcp.error.count': {
    name: 'mcp.error.count',
    type: 'counter',
    description: 'Number of errors',
    attributes: ['error_type', 'error_code', 'method'],
  },
};

/**
 * MCP Span Builder Interface
 */
export interface McpSpanBuilder {
  setSpanKind(kind: SpanKind): McpSpanBuilder;
  setAttributes(attributes: McpSpanAttributes): McpSpanBuilder;
  setParent(context: SpanContext): McpSpanBuilder;
  startSpan(name: string): Span;
}

/**
 * MCP Tracer Interface
 */
export interface McpTracer {
  startSpan(name: string, options?: McpSpanOptions): Span;
  startActiveSpan<T>(
    name: string,
    fn: (span: Span) => T
  ): T;
  startActiveSpan<T>(
    name: string,
    options: McpSpanOptions,
    fn: (span: Span) => T
  ): T;
}

/**
 * MCP Span Options
 */
export interface McpSpanOptions {
  kind?: SpanKind;
  attributes?: McpSpanAttributes;
  links?: SpanContext[];
  startTime?: number;
  root?: boolean;
}

/**
 * MCP OTel Provider Interface
 */
export interface McpOTelProvider {
  initialize(config: McpOTelConfig): Promise<void>;
  shutdown(): Promise<void>;
  getTracer(name: string, version?: string): McpTracer;
  getMeter(name: string, version?: string): any; // Meter type from metrics API
  getLogger(name: string, version?: string): any; // Logger type from logs API
  
  // Context propagation
  inject(context: SpanContext, carrier: any): void;
  extract(carrier: any): SpanContext | undefined;
}

/**
 * MCP Resource Attributes based on OpenTelemetry Semantic Conventions
 */
export const MCP_RESOURCE_ATTRIBUTES = {
  SERVICE_NAME: 'service.name',
  SERVICE_VERSION: 'service.version',
  SERVICE_NAMESPACE: 'service.namespace',
  SERVICE_INSTANCE_ID: 'service.instance.id',
  
  MCP_SERVER_VERSION: 'mcp.server.version',
  MCP_PROTOCOL_VERSION: 'mcp.protocol.version',
  MCP_TRANSPORT_TYPE: 'mcp.transport.type',
  MCP_CAPABILITIES: 'mcp.capabilities',
  
  DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
  HOST_NAME: 'host.name',
  HOST_TYPE: 'host.type',
  
  PROCESS_PID: 'process.pid',
  PROCESS_RUNTIME_NAME: 'process.runtime.name',
  PROCESS_RUNTIME_VERSION: 'process.runtime.version',
} as const;

/**
 * MCP Span Attributes based on OpenTelemetry Semantic Conventions
 */
export const MCP_SPAN_ATTRIBUTES = {
  // HTTP attributes
  HTTP_METHOD: 'http.method',
  HTTP_URL: 'http.url',
  HTTP_STATUS_CODE: 'http.status_code',
  HTTP_USER_AGENT: 'http.user_agent',
  
  // MCP-specific attributes
  MCP_METHOD: 'mcp.method',
  MCP_ENDPOINT: 'mcp.endpoint',
  MCP_REQUEST_ID: 'mcp.request.id',
  MCP_SESSION_ID: 'mcp.session.id',
  MCP_CLIENT_ID: 'mcp.client.id',
  MCP_TOOL_NAME: 'mcp.tool.name',
  MCP_RESOURCE_URI: 'mcp.resource.uri',
  MCP_PROMPT_NAME: 'mcp.prompt.name',
  MCP_ERROR_CODE: 'mcp.error.code',
  MCP_ERROR_TYPE: 'mcp.error.type',
  
  // Performance attributes
  MCP_RESPONSE_SIZE: 'mcp.response.size',
  MCP_REQUEST_SIZE: 'mcp.request.size',
  MCP_PROCESSING_TIME: 'mcp.processing.time',
  
  // Client attributes
  CLIENT_ID: 'client.id',
  CLIENT_ADDRESS: 'client.address',
  CLIENT_PORT: 'client.port',
} as const;

/**
 * MCP Span Names following OpenTelemetry conventions
 * Structured naming for better identification in SignOz
 */
export const MCP_SPAN_NAMES = {
  // Transport level - detailed protocol operations
  TRANSPORT_REQUEST: 'mcp.transport.request',
  TRANSPORT_CONNECTION: 'mcp.transport.connection',
  TRANSPORT_HTTP_REQUEST: (method: string) => `mcp.transport.http.${method.toLowerCase()}`,
  TRANSPORT_STDIO_REQUEST: 'mcp.transport.stdio.request',
  
  // Endpoint level - specific endpoint identification
  ENDPOINT_CALL: (method: string) => `mcp.endpoint.${method.replace('/', '.')}`,
  
  // Tool operations - specific tool identification
  TOOL_LIST: 'mcp.tools.list',
  TOOL_CALL: (toolName: string) => `mcp.tool.execute.${toolName.replace(/[^a-zA-Z0-9]/g, '_')}`,
  TOOL_VALIDATION: (toolName: string) => `mcp.tool.validate.${toolName.replace(/[^a-zA-Z0-9]/g, '_')}`,
  
  // Resource operations - specific resource operations
  RESOURCE_LIST: 'mcp.resources.list',
  RESOURCE_READ: (uri?: string) => uri ? `mcp.resource.read.${uri.split('/').pop() || 'unknown'}` : 'mcp.resource.read',
  RESOURCE_SUBSCRIBE: (uri?: string) => uri ? `mcp.resource.subscribe.${uri.split('/').pop() || 'unknown'}` : 'mcp.resource.subscribe',
  RESOURCE_UNSUBSCRIBE: (uri?: string) => uri ? `mcp.resource.unsubscribe.${uri.split('/').pop() || 'unknown'}` : 'mcp.resource.unsubscribe',
  
  // Prompt operations - specific prompt identification
  PROMPT_LIST: 'mcp.prompts.list',
  PROMPT_GET: (promptName: string) => `mcp.prompt.get.${promptName.replace(/[^a-zA-Z0-9]/g, '_')}`,
  
  // Lifecycle operations - detailed lifecycle tracking
  PING: 'mcp.lifecycle.ping',
  INITIALIZE: 'mcp.lifecycle.initialize',
  INITIALIZED_NOTIFICATION: 'mcp.lifecycle.initialized',
  SHUTDOWN: 'mcp.lifecycle.shutdown',
  
  // Sampling operations - specific sampling tasks
  SAMPLING_CREATE_MESSAGE: 'mcp.sampling.createMessage',
  
  // Completion operations - specific completion requests
  COMPLETION_COMPLETE: (provider?: string) => provider ? `mcp.completion.${provider}` : 'mcp.completion.complete',
  
  // Authentication and authorization
  AUTH_VALIDATE: 'mcp.auth.validate',
  AUTH_API_KEY: 'mcp.auth.api_key',
  AUTH_RATE_LIMIT: 'mcp.auth.rate_limit',
  
  // Session management
  SESSION_CREATE: 'mcp.session.create',
  SESSION_DESTROY: 'mcp.session.destroy',
  SESSION_UPDATE: 'mcp.session.update',
  
  // Business logic operations
  BUSINESS_OPERATION: (operation: string) => `mcp.business.${operation.replace(/[^a-zA-Z0-9]/g, '_')}`,
  
  // Testing and manual operations
  TEST_INTEGRATION: (testName: string) => `mcp.test.integration.${testName.replace(/[^a-zA-Z0-9]/g, '_')}`,
  TEST_MANUAL: (operation: string) => `mcp.test.manual.${operation.replace(/[^a-zA-Z0-9]/g, '_')}`,
  TEST_ENDPOINT: (endpoint: string) => `mcp.test.endpoint.${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
  
  // Error and debugging operations
  ERROR_HANDLING: (errorType: string) => `mcp.error.${errorType.replace(/[^a-zA-Z0-9]/g, '_')}`,
  DEBUG_OPERATION: (operation: string) => `mcp.debug.${operation.replace(/[^a-zA-Z0-9]/g, '_')}`,
} as const;

/**
 * MCP Metric Names following OpenTelemetry conventions
 */
export const MCP_METRIC_NAMES = {
  // Request metrics
  REQUEST_COUNT: 'mcp.request.count',
  REQUEST_DURATION: 'mcp.request.duration',
  REQUEST_SIZE: 'mcp.request.size',
  RESPONSE_SIZE: 'mcp.response.size',
  
  // Session metrics
  SESSION_ACTIVE: 'mcp.session.active',
  SESSION_DURATION: 'mcp.session.duration',
  SESSION_CREATED: 'mcp.session.created',
  SESSION_TERMINATED: 'mcp.session.terminated',
  
  // Tool metrics
  TOOL_EXECUTION_COUNT: 'mcp.tool.execution.count',
  TOOL_EXECUTION_DURATION: 'mcp.tool.execution.duration',
  TOOL_ERROR_COUNT: 'mcp.tool.error.count',
  
  // Resource metrics
  RESOURCE_ACCESS_COUNT: 'mcp.resource.access.count',
  RESOURCE_SUBSCRIPTION_COUNT: 'mcp.resource.subscription.count',
  
  // Error metrics
  ERROR_COUNT: 'mcp.error.count',
  
  // Performance metrics
  ACTIVE_SPANS: 'mcp.spans.active',
  DROPPED_SPANS: 'mcp.spans.dropped',
} as const;

/**
 * Helper function to create MCP resource
 */
export function createMcpResource(
  serviceName: string,
  serviceVersion: string,
  additionalAttributes?: Record<string, string | number | boolean>
): Partial<Resource> {
  return {
    attributes: {
      [MCP_RESOURCE_ATTRIBUTES.SERVICE_NAME]: serviceName,
      [MCP_RESOURCE_ATTRIBUTES.SERVICE_VERSION]: serviceVersion,
      [MCP_RESOURCE_ATTRIBUTES.MCP_PROTOCOL_VERSION]: '2025-06-18',
      ...additionalAttributes,
    },
  };
}