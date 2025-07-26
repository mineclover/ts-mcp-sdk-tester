/**
 * Application Constants
 * Central configuration using package.json and spec values
 */

import packageJson from "../package.json" with { type: "json" };
import { LATEST_PROTOCOL_VERSION , JSONRPC_VERSION } from "../spec/current_spec.js";

export const APP_CONFIG = {
  name: packageJson.name,
  displayName: "MCP SDK Tester",
  version: packageJson.version,
  protocol: LATEST_PROTOCOL_VERSION,
  jsonrpc: JSONRPC_VERSION,
} as const;

export const TRANSPORT_CONFIG = {
  defaultPort: 3000,
  endpoints: {
    mcp: "/mcp",
    health: "/health",
    info: "/info",
  },
} as const;