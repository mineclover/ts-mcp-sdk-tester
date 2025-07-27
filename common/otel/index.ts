/**
 * OpenTelemetry Integration Index
 * Export all OTel types and utilities
 */

// Export types
export * from './types.js';

// Export provider
export * from './provider.js';

// Re-export commonly used OpenTelemetry APIs
export { 
  trace, 
  metrics, 
  context,
  propagation,
  SpanStatusCode, 
  SpanKind,
  type Span,
  type SpanContext,
  type Tracer,
  type Meter,
  type Attributes,
} from '@opentelemetry/api';