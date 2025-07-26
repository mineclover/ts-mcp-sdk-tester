/**
 * Authenticated Request Types
 * 
 * Provides type-safe request interfaces that guarantee authentication context
 */

import type { Request } from "express";
import type { AuthContext } from "../authorization.js";

/**
 * Request that has been authenticated (guaranteed to have auth context)
 */
export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
}

/**
 * Type guard to check if request has been authenticated
 */
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return req.auth !== undefined;
}

/**
 * Assert that request has been authenticated (throws if not)
 * Use this after authentication middleware to guarantee type safety
 */
export function assertAuthenticated(req: Request): asserts req is AuthenticatedRequest {
  if (!req.auth) {
    throw new Error("Request has not been processed by authentication middleware");
  }
}

/**
 * Type guard for authenticated requests with specific auth method
 */
export function hasAuthMethod<T extends AuthContext['authMethod']>(
  req: Request, 
  method: T
): req is AuthenticatedRequest & { auth: AuthContext & { authMethod: T } } {
  return req.auth?.authMethod === method;
}

/**
 * Type guard for successfully authenticated requests (not just processed)
 */
export function isAuthenticated(req: Request): req is AuthenticatedRequest & { 
  auth: AuthContext & { isAuthenticated: true } 
} {
  return req.auth?.isAuthenticated === true;
}