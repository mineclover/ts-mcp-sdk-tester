/**
 * Express.js type extensions for MCP server
 */

import type { AuthContext } from "../authorization.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

// Extend Express Request interface
declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}

export {};