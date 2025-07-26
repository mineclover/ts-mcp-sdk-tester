import type { NextFunction, Request, Response } from "express";
import { getServerStatus } from "./lifecycle.js";
import { logger } from "./logger.js";
import type { AuthenticatedRequest } from "./types/authenticated-request.js";
import { assertAuthenticated } from "./types/authenticated-request.js";
// Types are extended globally via types/express.d.ts

/**
 * MCP Authorization and Security Middleware
 * 
 * Implements optional authorization features for HTTP transport as per MCP spec.
 * Note: Authorization is OPTIONAL for MCP implementations.
 * For STDIO transport, no authorization is needed.
 */

export interface AuthContext {
  isAuthenticated: boolean;
  clientId?: string;
  capabilities?: string[];
  authMethod?: 'none' | 'api-key' | 'oauth' | 'basic';
  metadata?: Record<string, unknown>;
}

/**
 * Simple API key authentication middleware
 * For development and testing purposes
 * 
 * After this middleware, req.auth is guaranteed to exist
 */
export function createAPIKeyAuth(validKeys: Set<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      // Allow unauthenticated access for MCP Inspector and development
      req.auth = {
        isAuthenticated: false,
        authMethod: 'none',
      };
      
      logger.debug("Unauthenticated request allowed", "auth");
      return next();
    }
    
    if (validKeys.has(apiKey)) {
      req.auth = {
        isAuthenticated: true,
        clientId: `api-key-${apiKey.slice(0, 8)}...`,
        authMethod: 'api-key',
        metadata: { keyLength: apiKey.length },
      };
      
      logger.debug(`API key authentication successful`, "auth");
      next();
    } else {
      logger.warning(`Invalid API key attempted: ${apiKey.slice(0, 8)}...`, "auth");
      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32602,
          message: "Invalid API key",
        },
        id: null,
      });
    }
  };
}

/**
 * Rate limiting middleware for MCP endpoints
 */
export function createRateLimiter(maxRequests: number = 100, windowMs: number = 60000) {
  const clients = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [id, data] of clients.entries()) {
      if (now > data.resetTime) {
        clients.delete(id);
      }
    }
    
    // Get or create client record
    let clientData = clients.get(clientId);
    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 0, resetTime: now + windowMs };
      clients.set(clientId, clientData);
    }
    
    // Check rate limit
    if (clientData.count >= maxRequests) {
      logger.warning(`Rate limit exceeded for client: ${clientId}`, "auth");
      res.status(429).json({
        jsonrpc: "2.0",
        error: {
          code: -32603, // Internal error
          message: "Rate limit exceeded",
          data: {
            limit: maxRequests,
            window: windowMs,
            retryAfter: Math.ceil((clientData.resetTime - now) / 1000),
          },
        },
        id: null,
      });
      return;
    }
    
    // Increment count
    clientData.count++;
    
    // Add rate limiting headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - clientData.count).toString(),
      'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString(),
    });
    
    next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Set security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  });
  
  next();
}

/**
 * JSON-RPC request body interface
 */
interface JSONRPCRequest {
  jsonrpc: string;
  method: string;
  params?: unknown;
  id?: string | number | null;
}

/**
 * Type guard to check if request body is a valid JSON-RPC request
 */
function isJSONRPCRequest(body: unknown): body is JSONRPCRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    'jsonrpc' in body &&
    'method' in body &&
    typeof (body as JSONRPCRequest).jsonrpc === 'string' &&
    typeof (body as JSONRPCRequest).method === 'string'
  );
}

/**
 * Request validation middleware for MCP
 */
export function validateMCPRequest(req: Request, res: Response, next: NextFunction) {
  // Only validate POST requests to /mcp endpoint
  if (req.method !== 'POST' || req.path !== '/mcp') {
    return next();
  }
  
  const serverStatus = getServerStatus();
  
  // Check if server is operational
  if (!serverStatus.isOperational) {
    logger.warning("Request received while server not operational", "auth");
    res.status(503).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Server not ready",
        data: {
          state: serverStatus.state,
          uptime: serverStatus.uptime,
        },
      },
      id: null,
    });
    return;
  }
  
  // Validate JSON-RPC structure using type guard
  if (!isJSONRPCRequest(req.body)) {
    logger.warning("Invalid request body structure", "auth");
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32700, // Parse error
        message: "Invalid Request: Expected JSON-RPC 2.0 format",
      },
      id: null,
    });
    return;
  }
  
  const { jsonrpc, method, id } = req.body;
  
  // Validate JSON-RPC version
  if (jsonrpc !== "2.0") {
    logger.warning(`Invalid JSON-RPC version: ${jsonrpc}`, "auth");
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600, // Invalid request
        message: "Invalid Request: JSON-RPC version must be 2.0",
      },
      id,
    });
    return;
  }
  
  // Validate method (already checked in type guard, but explicit for clarity)
  if (!method.trim()) {
    logger.warning("Empty method name", "auth");
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "Invalid Request: method cannot be empty",
      },
      id,
    });
    return;
  }
  
  // Log valid request
  logger.debug(`Valid MCP request: ${method}`, "auth");
  
  next();
}

/**
 * Authorization configuration for different environments
 */
export const AUTH_SETTINGS = {
  development: {
    requireAuth: false,
    allowUnauthenticated: true,
    rateLimit: { maxRequests: 1000, windowMs: 60000 },
    enableSecurityHeaders: true,
  },
  production: {
    requireAuth: true,
    allowUnauthenticated: false,
    rateLimit: { maxRequests: 100, windowMs: 60000 },
    enableSecurityHeaders: true,
  },
  testing: {
    requireAuth: false,
    allowUnauthenticated: true,
    rateLimit: { maxRequests: 10000, windowMs: 60000 },
    enableSecurityHeaders: false,
  },
} as const;

/**
 * Get current environment settings
 */
export function getAuthSettings() {
  const env = process.env.NODE_ENV || 'development';
  return AUTH_SETTINGS[env as keyof typeof AUTH_SETTINGS] || AUTH_SETTINGS.development;
}

/**
 * Authorization middleware options
 */
export interface AuthMiddlewareOptions {
  environment?: keyof typeof AUTH_SETTINGS;
  apiKeys?: string[];
  customRateLimit?: { maxRequests: number; windowMs: number };
}

/**
 * Create complete authorization middleware stack
 * After this middleware chain, req.auth is guaranteed to exist
 */
export function createAuthMiddleware(options?: AuthMiddlewareOptions) {
  const settings = getAuthSettings();
  const apiKeys = new Set(options?.apiKeys || []);
  const rateLimit = options?.customRateLimit || settings.rateLimit;
  
  const middleware: Array<(req: Request, res: Response, next: NextFunction) => void> = [];
  
  // Always add security headers in production
  if (settings.enableSecurityHeaders) {
    middleware.push(securityHeaders);
  }
  
  // Add rate limiting
  middleware.push(createRateLimiter(rateLimit.maxRequests, rateLimit.windowMs));
  
  // Add API key auth if keys are provided
  if (apiKeys.size > 0) {
    middleware.push(createAPIKeyAuth(apiKeys));
  } else {
    // If no API keys, still set default auth context
    middleware.push((req: Request, _res: Response, next: NextFunction) => {
      req.auth = {
        isAuthenticated: false,
        authMethod: 'none',
      };
      next();
    });
  }
  
  // Add MCP request validation
  middleware.push(validateMCPRequest);
  
  return middleware;
}

/**
 * Type-safe wrapper to guarantee auth context exists
 * Use this to wrap handlers that need auth context
 */
export function withAuth<T extends Request>(
  handler: (req: T & { auth: AuthContext }, res: Response, next: NextFunction) => void | Promise<void>
) {
  return (req: T, res: Response, next: NextFunction) => {
    if (!req.auth) {
      logger.error("Auth context missing - auth middleware not properly configured", "auth");
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error: Authentication context missing",
        },
        id: null,
      });
      return;
    }
    
    return handler(req as T & { auth: AuthContext }, res, next);
  };
}

/**
 * Utility functions for checking authentication status
 */

/**
 * Check if request is authenticated (type-safe version)
 * Use this for runtime checks
 */
export function isRequestAuthenticated(req: Request): boolean {
  return req.auth?.isAuthenticated ?? false;
}

/**
 * Get client ID from authenticated request (type-safe)
 * Throws if request hasn't been processed by auth middleware
 */
export function getClientId(req: AuthenticatedRequest): string | undefined {
  return req.auth.clientId;
}

/**
 * Get authentication method used (type-safe)
 * Throws if request hasn't been processed by auth middleware
 */
export function getAuthMethod(req: AuthenticatedRequest): AuthContext['authMethod'] {
  return req.auth.authMethod;
}

/**
 * Require authentication middleware
 * Use this to protect specific endpoints that require authentication
 * After this middleware, req is guaranteed to be AuthenticatedRequest with isAuthenticated: true
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // First assert that auth middleware has run
  assertAuthenticated(req);
  
  if (!req.auth.isAuthenticated) {
    logger.warning("Unauthorized access attempt", "auth");
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32602,
        message: "Authentication required",
        data: {
          authMethods: ['api-key'],
          headerRequired: 'x-api-key',
        },
      },
      id: null,
    });
    return;
  }
  
  logger.debug(`Authenticated request from client: ${req.auth.clientId}`, "auth");
  next();
}

/**
 * Log authentication details for audit purposes
 * Works with both authenticated and unauthenticated requests
 */
export function logAuthEvent(req: Request, event: string, details?: Record<string, unknown>) {
  const authInfo = {
    event,
    clientId: req.auth?.clientId,
    authMethod: req.auth?.authMethod ?? 'none',
    isAuthenticated: req.auth?.isAuthenticated ?? false,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    ...details,
  };
  
  logger.info(authInfo, "auth-audit");
}

/**
 * Type-safe version of logAuthEvent for authenticated requests
 */
export function logAuthenticatedEvent(
  req: AuthenticatedRequest, 
  event: string, 
  details?: Record<string, unknown>
) {
  const authInfo = {
    event,
    clientId: req.auth.clientId,
    authMethod: req.auth.authMethod,
    isAuthenticated: req.auth.isAuthenticated,
    userAgent: req.headers['user-agent'],
    ip: req.ip,
    ...details,
  };
  
  logger.info(authInfo, "auth-audit");
}