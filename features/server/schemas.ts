import { z } from 'zod';

/**
 * Shared Zod schemas for server domain
 * Common input validation schemas used across server-related features
 */

// Empty schema for server tools that don't require input
export const EmptySchema = z.object({});

// Server connection test schema
export const ServerConnectionTestSchema = z.object({
  includeDetails: z.boolean().default(false).describe("Whether to include detailed connection information"),
});

// Server info request schema
export const ServerInfoRequestSchema = z.object({
  includeSystem: z.boolean().default(true).describe("Whether to include system information"),
  includeMemory: z.boolean().default(true).describe("Whether to include memory usage"),
  includeCapabilities: z.boolean().default(true).describe("Whether to include server capabilities"),
  includeUptime: z.boolean().default(true).describe("Whether to include uptime information"),
});

// Server status schema
export const ServerStatusSchema = z.enum(["connected", "disconnected", "connecting", "error"]);

// Server capability schema
export const ServerCapabilitySchema = z.object({
  logging: z.boolean().default(true),
  resources: z.boolean().default(true),
  tools: z.boolean().default(true),
  prompts: z.boolean().default(true),
  notifications: z.boolean().default(true),
});

// System information schema
export const SystemInfoSchema = z.object({
  platform: z.string(),
  arch: z.string(),
  nodeVersion: z.string(),
  pid: z.number(),
  uptime: z.number(),
});

// Memory usage schema
export const MemoryUsageSchema = z.object({
  rss: z.number(),
  heapTotal: z.number(),
  heapUsed: z.number(),
  external: z.number(),
  arrayBuffers: z.number(),
});

// Server metadata schema
export const ServerMetadataSchema = z.object({
  name: z.string(),
  version: z.string(),
  timestamp: z.string(),
  connected: z.boolean(),
  capabilities: ServerCapabilitySchema,
  system: SystemInfoSchema.optional(),
  memory: MemoryUsageSchema.optional(),
});

// Boolean flag schema
export const BooleanFlagSchema = z.boolean().default(true);

// Server configuration schema
export const ServerConfigSchema = z.object({
  enableLogging: BooleanFlagSchema,
  enableResources: BooleanFlagSchema,
  enableTools: BooleanFlagSchema,
  enablePrompts: BooleanFlagSchema, 
  enableNotifications: BooleanFlagSchema,
});