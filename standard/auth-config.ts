/**
 * Authentication and Server Configuration
 * 
 * Centralized configuration for MCP server authentication,
 * capabilities, and client instructions.
 */

import type { ServerCapabilities, Implementation } from "../spec/current_spec.js";
import { APP_CONFIG } from "./constants.js";

export const AUTH_CONFIG = {
  // Supported protocol versions in order of preference  
  supportedVersions: [
    APP_CONFIG.protocol,
    "2025-03-26", 
    "2024-11-05", 
    "2024-10-07"
  ] as const,

  // Server capabilities that this implementation provides
  capabilities: {
    experimental: {
      "mcp-sdk-tester": {
        version: APP_CONFIG.version,
        features: ["comprehensive-testing", "all-endpoints", "standard-protocol"],
      },
    },
    logging: {},
    completions: {},
    prompts: {
      listChanged: true,
    },
    resources: {
      subscribe: true,
      listChanged: true,
    },
    tools: {
      listChanged: true,
    },
  } as ServerCapabilities,

  // Server implementation information
  serverInfo: {
    name: APP_CONFIG.name,
    title: APP_CONFIG.displayName,
    version: APP_CONFIG.version,
  } as Implementation,

  // Instructions for clients/LLMs
  instructions: `
${APP_CONFIG.displayName} - Standard Protocol Implementation

This server implements all standard MCP specification endpoints:

Core Protocol:
- ping: Health check and connectivity test
- initialize: Client initialization and capability negotiation

Resources Management:
- resources/list: List all available resources with pagination
- resources/templates/list: List resource URI templates
- resources/read: Read content of specific resources
- resources/subscribe: Subscribe to resource update notifications
- resources/unsubscribe: Unsubscribe from resource updates

Prompts Management:
- prompts/list: List available prompts and templates
- prompts/get: Get specific prompt with argument templating

Tools Management:
- tools/list: List available tools with input/output schemas
- tools/call: Execute tools with proper error handling

Advanced Protocol Features:
- sampling/createMessage: Request LLM sampling from client
- elicitation/create: Request structured user input
- roots/list: Request available root directories

All endpoints follow MCP specification standards with:
- Proper error handling and validation
- Structured response formats
- Pagination support where applicable
- Type-safe parameter and result handling
- Comprehensive metadata in responses
  `.trim(),
} as const;