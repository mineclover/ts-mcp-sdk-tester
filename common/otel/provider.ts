/**
 * OpenTelemetry Provider Implementation for MCP Server
 * Provides initialization and management of OTel SDK components
 */

import { NodeSDK, type NodeSDKConfiguration } from "@opentelemetry/sdk-node";
import {
  Resource,
  detectResourcesSync,
  envDetectorSync,
  hostDetectorSync,
  osDetectorSync,
  processDetectorSync,
} from "@opentelemetry/resources";
import {
  trace,
  metrics,
  context,
  propagation,
  SpanStatusCode,
  SpanKind,
  type Span,
  type SpanContext,
} from "@opentelemetry/api";
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
  MeterProvider,
} from "@opentelemetry/sdk-metrics";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { W3CTraceContextPropagator } from "@opentelemetry/core";

import type {
  McpOTelConfig,
  McpOTelProvider,
  McpTracer,
  McpSpanOptions,
  McpSpanAttributes,
  OTelExporterConfig,
} from "./types.js";
import { MCP_RESOURCE_ATTRIBUTES, createMcpResource } from "./types.js";

/**
 * Default OTel Provider implementation for MCP
 */
export class DefaultMcpOTelProvider implements McpOTelProvider {
  private sdk?: NodeSDK;
  private config?: McpOTelConfig;
  private initialized = false;

  async initialize(config: McpOTelConfig): Promise<void> {
    if (this.initialized) {
      console.warn("OTel provider already initialized");
      return;
    }

    this.config = config;

    // Create resource with automatic detection
    const autoResource = detectResourcesSync({
      detectors: [envDetectorSync, hostDetectorSync, osDetectorSync, processDetectorSync],
    });

    // Merge with MCP-specific resource attributes
    const mcpResource = createMcpResource(config.serviceName, config.serviceVersion, {
      [MCP_RESOURCE_ATTRIBUTES.SERVICE_NAMESPACE]: config.serviceNamespace || "mcp",
      [MCP_RESOURCE_ATTRIBUTES.DEPLOYMENT_ENVIRONMENT]:
        config.deploymentEnvironment || "development",
      ...config.resourceAttributes,
    });

    const resource = autoResource.merge(new Resource(mcpResource.attributes || {}));

    // Configure SDK
    const sdkConfig: Partial<NodeSDKConfiguration> = {
      resource,
      // Set up context propagator
      textMapPropagator: new W3CTraceContextPropagator(),
    };

    // Configure instrumentations if enabled
    if (config.features?.autoInstrumentation) {
      sdkConfig.instrumentations = [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": {
            enabled: false, // Disable fs instrumentation to reduce noise
          },
        }),
      ];
    }

    // Configure trace exporter
    if (config.exporters.traces) {
      const spanProcessor = this.createSpanProcessor(config.exporters.traces);
      if (spanProcessor) {
        sdkConfig.spanProcessors = [spanProcessor];
      }
    }

    // Create and initialize SDK
    this.sdk = new NodeSDK(sdkConfig);

    // Configure metrics if enabled
    if (config.exporters.metrics) {
      this.configureMetrics(config.exporters.metrics, resource);
    }

    // Start SDK
    await this.sdk.start();

    // Set global propagator
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());

    this.initialized = true;
    console.log(`OTel provider initialized for service: ${config.serviceName}`);
  }

  async shutdown(): Promise<void> {
    if (!this.initialized || !this.sdk) {
      return;
    }

    try {
      await this.sdk.shutdown();
      this.initialized = false;
      console.log("OTel provider shut down successfully");
    } catch (error) {
      console.error("Error shutting down OTel provider:", error);
      throw error;
    }
  }

  getTracer(name: string, version?: string): McpTracer {
    const tracer = trace.getTracer(name, version);

    // Wrap the tracer to provide MCP-specific functionality
    return {
      startSpan(spanName: string, options?: McpSpanOptions): Span {
        const span = tracer.startSpan(spanName, {
          kind: options?.kind || SpanKind.INTERNAL,
          attributes: options?.attributes,
          links: options?.links,
          startTime: options?.startTime,
          root: options?.root,
        });

        // Add default MCP attributes
        if (options?.attributes) {
          span.setAttributes(options.attributes);
        }

        return span;
      },

      startActiveSpan<T>(spanName: string, arg2: unknown, arg3?: unknown): T {
        // Handle overloaded method signatures
        if (typeof arg2 === "function") {
          // startActiveSpan(name, fn)
          return tracer.startActiveSpan(spanName, arg2);
        } else {
          // startActiveSpan(name, options, fn)
          return tracer.startActiveSpan(spanName, arg2, arg3);
        }
      },
    };
  }

  getMeter(name: string, version?: string): unknown {
    return metrics.getMeter(name, version);
  }

  getLogger(name: string, version?: string): unknown {
    // Note: Logs API is experimental in OpenTelemetry
    // Return null for now as it's not yet stable
    console.warn("OTel Logs API is experimental and not yet implemented");
    return null;
  }

  inject(spanContext: SpanContext, carrier: Record<string, unknown>): void {
    const activeContext = trace.setSpanContext(context.active(), spanContext);
    propagation.inject(activeContext, carrier);
  }

  extract(carrier: Record<string, unknown>): SpanContext | undefined {
    const extractedContext = propagation.extract(context.active(), carrier);
    return trace.getSpanContext(extractedContext);
  }

  /**
   * Create span processor based on exporter configuration
   */
  private createSpanProcessor(exporterConfig: OTelExporterConfig) {
    let exporter;

    switch (exporterConfig.type) {
      case "otlp-http":
        exporter = new OTLPTraceExporter({
          url: exporterConfig.endpoint,
          headers: exporterConfig.headers,
          timeoutMillis: exporterConfig.timeout,
          compression: exporterConfig.compression,
        });
        break;

      case "console":
        exporter = new ConsoleSpanExporter();
        break;

      default:
        console.warn(`Unsupported trace exporter type: ${exporterConfig.type}`);
        return null;
    }

    // Use batch processor with short intervals for better span collection
    return new BatchSpanProcessor(exporter, {
      // Export every 1 second or when 10 spans are collected
      scheduledDelayMillis: 1000,
      maxExportBatchSize: 10,
      maxQueueSize: 1000,
      exportTimeoutMillis: 5000,
    });
  }

  /**
   * Configure metrics collection
   */
  private configureMetrics(exporterConfig: OTelExporterConfig, resource: Resource) {
    let metricExporter;

    switch (exporterConfig.type) {
      case "otlp-http":
        metricExporter = new OTLPMetricExporter({
          url: exporterConfig.endpoint,
          headers: exporterConfig.headers,
          timeoutMillis: exporterConfig.timeout,
          compression: exporterConfig.compression,
        });
        break;

      case "console":
        metricExporter = new ConsoleMetricExporter();
        break;

      default:
        console.warn(`Unsupported metric exporter type: ${exporterConfig.type}`);
        return;
    }

    const meterProvider = new MeterProvider({
      resource,
      readers: [
        new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 10000, // Export every 10 seconds
        }),
      ],
    });

    metrics.setGlobalMeterProvider(meterProvider);
  }
}

/**
 * Singleton instance of MCP OTel Provider
 */
let providerInstance: McpOTelProvider | null = null;

/**
 * Get or create the MCP OTel Provider instance
 */
export function getMcpOTelProvider(): McpOTelProvider {
  if (!providerInstance) {
    providerInstance = new DefaultMcpOTelProvider();
  }
  return providerInstance;
}

/**
 * Helper function to create a traced function
 */
export function traced<T extends (...args: any[]) => any>(
  tracer: McpTracer,
  spanName: string,
  fn: T,
  spanOptions?: McpSpanOptions
): T {
  return ((...args: Parameters<T>) => {
    return tracer.startActiveSpan(spanName, spanOptions || {}, (span) => {
      try {
        const result = fn(...args);

        // Handle async functions
        if (result instanceof Promise) {
          return result
            .then((value) => {
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();
              return value;
            })
            .catch((error) => {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
              });
              span.recordException(error);
              span.end();
              throw error;
            });
        }

        // Handle sync functions
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        span.end();
        throw error;
      }
    });
  }) as T;
}

/**
 * Helper to add MCP-specific attributes to current span
 */
export function addMcpAttributes(attributes: McpSpanAttributes): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Helper to record an MCP event on the current span
 */
export function recordMcpEvent(name: string, attributes?: Record<string, any>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}
