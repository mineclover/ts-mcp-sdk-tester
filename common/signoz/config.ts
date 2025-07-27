/**
 * SigNoz Configuration for MCP Server
 * Configuration and setup for SigNoz integration
 */

import type { McpOTelConfig } from "../otel/types.js";

/**
 * SigNoz-specific configuration
 */
export interface SigNozConfig {
  // SigNoz backend endpoint
  endpoint: string;

  // Service identification
  serviceName: string;
  serviceVersion: string;
  serviceNamespace?: string;

  // Environment
  environment?: "development" | "staging" | "production" | "test";

  // Authentication (for SigNoz Cloud)
  apiKey?: string;

  // Feature toggles
  features?: {
    traces?: boolean;
    metrics?: boolean;
    logs?: boolean;
    profiling?: boolean;
  };

  // Advanced options
  insecure?: boolean;
  compression?: "none" | "gzip";
  timeout?: number;

  // Custom resource attributes
  customAttributes?: Record<string, string | number | boolean>;
}

/**
 * Default SigNoz endpoints
 */
export const SIGNOZ_ENDPOINTS = {
  // Self-hosted SigNoz (local)
  LOCAL: {
    traces: "http://localhost:4318/v1/traces",
    metrics: "http://localhost:4318/v1/metrics",
    logs: "http://localhost:4318/v1/logs",
  },

  // SigNoz Cloud endpoints (placeholder - use actual cloud endpoint)
  CLOUD: {
    traces: "https://ingest.signoz.cloud/v1/traces",
    metrics: "https://ingest.signoz.cloud/v1/metrics",
    logs: "https://ingest.signoz.cloud/v1/logs",
  },
} as const;

/**
 * Create MCP OTel configuration for SigNoz
 */
export function createSigNozConfig(config: SigNozConfig): McpOTelConfig {
  const _isCloud = config.endpoint.includes("signoz.cloud");
  const baseEndpoint = config.endpoint || SIGNOZ_ENDPOINTS.LOCAL.traces;

  // Extract base URL from endpoint
  const endpointUrl = new URL(baseEndpoint);
  const baseUrl = `${endpointUrl.protocol}//${endpointUrl.host}`;

  // Build headers for authentication
  const headers: Record<string, string> = {};
  if (config.apiKey) {
    headers["signoz-access-token"] = config.apiKey;
  }

  const mcpConfig: McpOTelConfig = {
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    serviceNamespace: config.serviceNamespace,
    deploymentEnvironment: config.environment || "development",

    exporters: {},

    // Default sampling configuration
    sampling: {
      parentBased: true,
      traceIdRatio: config.environment === "production" ? 0.1 : 1.0, // 10% in prod, 100% in dev
    },

    // Resource attributes
    resourceAttributes: {
      "deployment.environment": config.environment || "development",
      "signoz.integration": "mcp-server",
      ...config.customAttributes,
    },

    // Feature flags
    features: {
      autoInstrumentation: true,
      manualSpans: true,
      customMetrics: true,
      contextPropagation: true,
    },
  };

  // Configure trace exporter if enabled
  if (config.features?.traces !== false) {
    mcpConfig.exporters.traces = {
      type: "otlp-http",
      endpoint: `${baseUrl}/v1/traces`,
      headers,
      timeout: config.timeout || 10000,
      compression: config.compression || "gzip",
      insecure: config.insecure,
    };
  }

  // Configure metrics exporter if enabled
  if (config.features?.metrics !== false) {
    mcpConfig.exporters.metrics = {
      type: "otlp-http",
      endpoint: `${baseUrl}/v1/metrics`,
      headers,
      timeout: config.timeout || 10000,
      compression: config.compression || "gzip",
      insecure: config.insecure,
    };
  }

  // Configure logs exporter if enabled
  if (config.features?.logs === true) {
    mcpConfig.exporters.logs = {
      type: "otlp-http",
      endpoint: `${baseUrl}/v1/logs`,
      headers,
      timeout: config.timeout || 10000,
      compression: config.compression || "gzip",
      insecure: config.insecure,
    };
  }

  return mcpConfig;
}

/**
 * Environment-based SigNoz configuration
 */
export function getSigNozConfigFromEnv(): SigNozConfig {
  const config: SigNozConfig = {
    // Endpoint configuration
    endpoint: process.env.SIGNOZ_ENDPOINT || SIGNOZ_ENDPOINTS.LOCAL.traces,

    // Service identification
    serviceName: process.env.OTEL_SERVICE_NAME || "mcp-server",
    serviceVersion: process.env.OTEL_SERVICE_VERSION || "1.0.0",
    serviceNamespace: process.env.OTEL_SERVICE_NAMESPACE,

    // Environment
    environment:
      (process.env.NODE_ENV as "development" | "staging" | "production" | "test") || "development",

    // Authentication
    apiKey: process.env.SIGNOZ_API_KEY,

    // Features
    features: {
      traces: process.env.SIGNOZ_TRACES_ENABLED !== "false",
      metrics: process.env.SIGNOZ_METRICS_ENABLED !== "false",
      logs: process.env.SIGNOZ_LOGS_ENABLED === "true", // Opt-in for logs
      profiling: process.env.SIGNOZ_PROFILING_ENABLED === "true", // Opt-in for profiling
    },

    // Advanced options
    insecure: process.env.SIGNOZ_INSECURE === "true",
    compression: (process.env.SIGNOZ_COMPRESSION as "none" | "gzip") || "gzip",
    timeout: process.env.SIGNOZ_TIMEOUT ? parseInt(process.env.SIGNOZ_TIMEOUT, 10) : 10000,
  };

  // Parse custom attributes from environment
  if (process.env.SIGNOZ_CUSTOM_ATTRIBUTES) {
    try {
      config.customAttributes = JSON.parse(process.env.SIGNOZ_CUSTOM_ATTRIBUTES);
    } catch (error) {
      console.warn("Failed to parse SIGNOZ_CUSTOM_ATTRIBUTES:", error);
    }
  }

  return config;
}

/**
 * Validate SigNoz configuration
 */
export function validateSigNozConfig(config: SigNozConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate endpoint
  if (!config.endpoint) {
    errors.push("Endpoint is required");
  } else {
    try {
      new URL(config.endpoint);
    } catch {
      errors.push("Invalid endpoint URL");
    }
  }

  // Validate service name
  if (!config.serviceName) {
    errors.push("Service name is required");
  } else if (!/^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(config.serviceName)) {
    errors.push(
      "Service name must start with a letter and contain only alphanumeric characters, dots, dashes, and underscores"
    );
  }

  // Validate service version
  if (!config.serviceVersion) {
    errors.push("Service version is required");
  }

  // Validate environment
  if (
    config.environment &&
    !["development", "staging", "production", "test"].includes(config.environment)
  ) {
    errors.push("Environment must be one of: development, staging, production, test");
  }

  // Validate timeout
  if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
    errors.push("Timeout must be between 1000ms and 300000ms");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
