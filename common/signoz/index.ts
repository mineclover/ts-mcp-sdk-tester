/**
 * SigNoz Integration for MCP Server
 * Main entry point for SigNoz observability
 */

import { trace, metrics, SpanStatusCode, SpanKind } from "@opentelemetry/api";
import type { Span, Tracer, Meter } from "@opentelemetry/api";
import { getMcpOTelProvider } from "../otel/provider.js";
import type { McpOTelProvider, McpTracer } from "../otel/types.js";
import { MCP_SPAN_ATTRIBUTES, MCP_SPAN_NAMES, MCP_METRIC_NAMES } from "../otel/types.js";
import {
  createSigNozConfig,
  getSigNozConfigFromEnv,
  validateSigNozConfig,
  type SigNozConfig,
} from "./config.js";
import { logger } from "../../standard/logger.js";

/**
 * SigNoz Integration Manager
 */
export class SigNozIntegration {
  private static instance: SigNozIntegration;
  private provider: McpOTelProvider;
  private tracer?: McpTracer;
  private meter?: Meter;
  private initialized = false;
  private config?: SigNozConfig;

  private constructor() {
    this.provider = getMcpOTelProvider();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SigNozIntegration {
    if (!SigNozIntegration.instance) {
      SigNozIntegration.instance = new SigNozIntegration();
    }
    return SigNozIntegration.instance;
  }

  /**
   * Initialize SigNoz integration
   */
  async initialize(config?: SigNozConfig): Promise<void> {
    if (this.initialized) {
      logger.warning("SigNoz integration already initialized", "signoz");
      return;
    }

    try {
      // Use provided config or get from environment
      this.config = config || getSigNozConfigFromEnv();

      // Validate configuration
      const validation = validateSigNozConfig(this.config);
      if (!validation.valid) {
        throw new Error(`Invalid SigNoz configuration: ${validation.errors.join(", ")}`);
      }

      // Create OTel configuration
      const otelConfig = createSigNozConfig(this.config);

      // Initialize OTel provider
      await this.provider.initialize(otelConfig);

      // Get tracer and meter
      this.tracer = this.provider.getTracer(this.config.serviceName, this.config.serviceVersion);

      this.meter = this.provider.getMeter(this.config.serviceName, this.config.serviceVersion);

      // Set up metrics
      this.setupMetrics();

      this.initialized = true;
      logger.info(
        {
          message: "SigNoz integration initialized successfully",
          endpoint: this.config.endpoint,
          serviceName: this.config.serviceName,
          serviceVersion: this.config.serviceVersion,
          environment: this.config.environment,
        },
        "signoz"
      );
    } catch (error) {
      logger.error(
        {
          message: "Failed to initialize SigNoz integration",
          error: error instanceof Error ? error.message : String(error),
        },
        "signoz"
      );
      throw error;
    }
  }

  /**
   * Shutdown SigNoz integration
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await this.provider.shutdown();
      this.initialized = false;
      logger.info("SigNoz integration shut down successfully", "signoz");
    } catch (error) {
      logger.error(
        {
          message: "Error shutting down SigNoz integration",
          error: error instanceof Error ? error.message : String(error),
        },
        "signoz"
      );
      throw error;
    }
  }

  /**
   * Get the tracer instance
   */
  getTracer(): McpTracer | undefined {
    return this.tracer;
  }

  /**
   * Get the meter instance
   */
  getMeter(): Meter | undefined {
    return this.meter;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Start a new span for MCP operation
   */
  startMcpSpan(operation: string, attributes?: Record<string, any>): Span | undefined {
    if (!this.tracer) {
      return undefined;
    }

    return this.tracer.startSpan(operation, {
      kind: SpanKind.SERVER,
      attributes: {
        [MCP_SPAN_ATTRIBUTES.MCP_METHOD]: operation,
        ...attributes,
      },
    });
  }

  /**
   * Start an active span (automatically manages context)
   */
  async withSpan<T>(
    operation: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    if (!this.tracer) {
      return fn(trace.getActiveSpan() || ({} as Span));
    }

    return this.tracer.startActiveSpan(
      operation,
      {
        kind: SpanKind.SERVER,
        attributes: {
          [MCP_SPAN_ATTRIBUTES.MCP_METHOD]: operation,
          ...attributes,
        },
      },
      async (span) => {
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  /**
   * Record an MCP request
   */
  recordMcpRequest(
    method: string,
    status: "success" | "error",
    duration: number,
    attributes?: Record<string, any>
  ): void {
    if (!this.meter) {
      return;
    }

    // Request counter
    const counter = this.meter.createCounter(MCP_METRIC_NAMES.REQUEST_COUNT, {
      description: "Total number of MCP requests",
    });

    counter.add(1, {
      method,
      status,
      ...attributes,
    });

    // Request duration histogram
    const histogram = this.meter.createHistogram(MCP_METRIC_NAMES.REQUEST_DURATION, {
      description: "MCP request duration in milliseconds",
      unit: "ms",
    });

    histogram.record(duration, {
      method,
      status,
      ...attributes,
    });
  }

  /**
   * Record tool execution
   */
  recordToolExecution(toolName: string, status: "success" | "error", duration: number): void {
    if (!this.meter) {
      return;
    }

    // Tool execution counter
    const counter = this.meter.createCounter(MCP_METRIC_NAMES.TOOL_EXECUTION_COUNT, {
      description: "Number of tool executions",
    });

    counter.add(1, {
      tool_name: toolName,
      status,
    });

    // Tool execution duration
    const histogram = this.meter.createHistogram(MCP_METRIC_NAMES.TOOL_EXECUTION_DURATION, {
      description: "Tool execution duration in milliseconds",
      unit: "ms",
    });

    histogram.record(duration, {
      tool_name: toolName,
      status,
    });
  }

  /**
   * Record session metrics
   */
  recordSessionMetrics(
    action: "created" | "terminated",
    transportType: string,
    duration?: number
  ): void {
    if (!this.meter) {
      return;
    }

    if (action === "created") {
      const counter = this.meter.createCounter(MCP_METRIC_NAMES.SESSION_CREATED, {
        description: "Number of sessions created",
      });

      counter.add(1, {
        transport_type: transportType,
      });

      // Update active sessions gauge
      const upDownCounter = this.meter.createUpDownCounter(MCP_METRIC_NAMES.SESSION_ACTIVE, {
        description: "Number of active sessions",
      });

      upDownCounter.add(1, {
        transport_type: transportType,
      });
    } else if (action === "terminated" && duration !== undefined) {
      const counter = this.meter.createCounter(MCP_METRIC_NAMES.SESSION_TERMINATED, {
        description: "Number of sessions terminated",
      });

      counter.add(1, {
        transport_type: transportType,
      });

      // Update active sessions gauge
      const upDownCounter = this.meter.createUpDownCounter(MCP_METRIC_NAMES.SESSION_ACTIVE, {
        description: "Number of active sessions",
      });

      upDownCounter.add(-1, {
        transport_type: transportType,
      });

      // Record session duration
      const histogram = this.meter.createHistogram(MCP_METRIC_NAMES.SESSION_DURATION, {
        description: "Session duration in milliseconds",
        unit: "ms",
      });

      histogram.record(duration, {
        transport_type: transportType,
      });
    }
  }

  /**
   * Record error
   */
  recordError(errorType: string, errorCode: number, method?: string): void {
    if (!this.meter) {
      return;
    }

    const counter = this.meter.createCounter(MCP_METRIC_NAMES.ERROR_COUNT, {
      description: "Number of errors",
    });

    counter.add(1, {
      error_type: errorType,
      error_code: errorCode,
      method: method || "unknown",
    });
  }

  /**
   * Set up standard metrics collectors
   */
  private setupMetrics(): void {
    if (!this.meter) {
      return;
    }

    // Observable gauge for active spans (if we track them)
    this.meter.createObservableGauge(
      MCP_METRIC_NAMES.ACTIVE_SPANS,
      {
        description: "Number of active spans",
      },
      (result) => {
        // This would need to be tracked elsewhere
        result.observe(0, { type: "manual" });
      }
    );
  }
}

// Export singleton instance
export const signoz = SigNozIntegration.getInstance();

/**
 * Express middleware for tracing HTTP requests
 */
export function sigNozHttpMiddleware() {
  return async (req: any, res: any, next: any) => {
    const signozInstance = SigNozIntegration.getInstance();
    if (!signozInstance.isInitialized()) {
      return next();
    }

    const startTime = Date.now();
    const spanName = `${req.method} ${req.path}`;

    await signozInstance.withSpan(
      spanName,
      async (span) => {
        // Add HTTP attributes
        span.setAttributes({
          [MCP_SPAN_ATTRIBUTES.HTTP_METHOD]: req.method,
          [MCP_SPAN_ATTRIBUTES.HTTP_URL]: req.url,
          [MCP_SPAN_ATTRIBUTES.HTTP_USER_AGENT]: req.headers["user-agent"] || "unknown",
          [MCP_SPAN_ATTRIBUTES.CLIENT_ADDRESS]: req.ip || req.connection?.remoteAddress,
        });

        // Wrap response end to capture status
        const originalEnd = res.end;
        res.end = (...args: any[]) => {
          const duration = Date.now() - startTime;

          // Add response attributes
          span.setAttributes({
            [MCP_SPAN_ATTRIBUTES.HTTP_STATUS_CODE]: res.statusCode,
            [MCP_SPAN_ATTRIBUTES.MCP_PROCESSING_TIME]: duration,
          });

          // Record metrics
          signozInstance.recordMcpRequest(
            req.path,
            res.statusCode >= 400 ? "error" : "success",
            duration,
            {
              http_method: req.method,
              http_status_code: res.statusCode,
            }
          );

          // Call original end
          return originalEnd.apply(res, args);
        };

        // Continue with request
        next();

        // Only add finish listener if res.on exists (real response object)
        if (typeof res.on === "function") {
          res.on("finish", () => {
            // Request finished
          });
        }
      },
      {
        "http.route": req.route?.path || req.path,
        "http.target": req.originalUrl || req.url,
      }
    );
  };
}
