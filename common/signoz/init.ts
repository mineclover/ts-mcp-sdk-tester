/**
 * SigNoz Initialization Module
 * Initialize SigNoz integration for MCP Server
 */

import { signoz } from './index.js';
import { getSigNozConfigFromEnv, type SigNozConfig } from './config.js';
import { logger } from '../../standard/logger.js';

/**
 * Initialize SigNoz with default or custom configuration
 */
export async function initializeSigNoz(customConfig?: SigNozConfig): Promise<void> {
  try {
    // Check if already initialized
    if (signoz.isInitialized()) {
      logger.warning('SigNoz already initialized, skipping', 'signoz');
      return;
    }
    
    // Force shutdown any existing instance to ensure clean initialization
    await signoz.shutdown();
    
    // Use custom config or load from environment
    const config = customConfig || getSigNozConfigFromEnv();
    
    logger.info({
      message: 'Initializing SigNoz integration',
      endpoint: config.endpoint,
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      environment: config.environment,
      features: config.features,
    }, 'signoz');
    
    // Initialize SigNoz
    await signoz.initialize(config);
    
    // Register shutdown handler
    process.on('SIGTERM', async () => {
      logger.info('Shutting down SigNoz integration (SIGTERM)', 'signoz');
      await signoz.shutdown();
    });
    
    process.on('SIGINT', async () => {
      logger.info('Shutting down SigNoz integration (SIGINT)', 'signoz');
      await signoz.shutdown();
    });
    
    // Log successful initialization
    logger.info({
      message: 'SigNoz integration initialized and ready',
      tracingEnabled: config.features?.traces !== false,
      metricsEnabled: config.features?.metrics !== false,
      logsEnabled: config.features?.logs === true,
    }, 'signoz');
    
  } catch (error) {
    logger.error({
      message: 'Failed to initialize SigNoz integration',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, 'signoz');
    
    // Re-throw to allow handling by caller
    throw error;
  }
}

/**
 * Initialize SigNoz only if enabled via environment
 */
export async function conditionalInitializeSigNoz(): Promise<boolean> {
  // Check if SigNoz is enabled
  const sigNozEnabled = process.env.SIGNOZ_ENABLED !== 'false' && (
    process.env.SIGNOZ_ENDPOINT || 
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    process.env.NODE_ENV === 'production'
  );
  
  if (!sigNozEnabled) {
    logger.info('SigNoz integration disabled (set SIGNOZ_ENABLED=true or SIGNOZ_ENDPOINT to enable)', 'signoz');
    return false;
  }
  
  try {
    await initializeSigNoz();
    return true;
  } catch (error) {
    logger.error({
      message: 'SigNoz initialization failed, continuing without observability',
      error: error instanceof Error ? error.message : String(error),
    }, 'signoz');
    return false;
  }
}

/**
 * Create a SigNoz-enabled MCP server startup function
 */
export function createSigNozEnabledServer(
  serverFactory: () => Promise<any>,
  sigNozConfig?: SigNozConfig
): () => Promise<any> {
  return async () => {
    // Initialize SigNoz first
    const sigNozEnabled = sigNozConfig 
      ? await initializeSigNoz(sigNozConfig).then(() => true).catch(() => false)
      : await conditionalInitializeSigNoz();
    
    logger.info({
      message: 'Starting MCP server',
      sigNozEnabled,
    }, 'signoz');
    
    // Create and return the server
    const server = await serverFactory();
    
    // If SigNoz is enabled, add telemetry info to server metadata
    if (sigNozEnabled && server.metadata) {
      server.metadata.telemetry = {
        provider: 'signoz',
        enabled: true,
        features: {
          tracing: true,
          metrics: true,
          logs: false,
        },
      };
    }
    
    return server;
  };
}

// Export configuration helpers for convenience
export { getSigNozConfigFromEnv, type SigNozConfig } from './config.js';

// Export the main signoz instance
export { signoz } from './index.js';

// Export helper functions
export * from './helpers.js';