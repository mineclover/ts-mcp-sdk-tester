import { z } from 'zod';

/**
 * Shared Zod schemas for tools domain
 * Common input validation schemas used across tool-related features
 */

// Basic tool registration schema
export const ToolRegistrationSchema = z.object({
  name: z.string().describe("Name of the tool to register"),
  description: z.string().describe("Description of the tool"),
});

// Simple tool registration schema (with response)
export const SimpleToolRegistrationSchema = ToolRegistrationSchema.extend({
  response: z.string().describe("Response text the tool should return"),
});

// Parameterized tool registration schema
export const ParameterizedToolRegistrationSchema = ToolRegistrationSchema.extend({
  paramName: z.string().describe("Name of the parameter"),
  paramDescription: z.string().describe("Description of the parameter"),
  paramType: z.enum(["string", "number", "boolean"]).describe("Type of the parameter"),
});

// Advanced tool registration schema
export const AdvancedToolRegistrationSchema = ToolRegistrationSchema.extend({
  destructiveHint: z.boolean().optional().describe("Whether the tool performs destructive operations"),
  idempotentHint: z.boolean().optional().describe("Whether the tool is idempotent"),
});

// Async tool registration schema
export const AsyncToolRegistrationSchema = ToolRegistrationSchema.extend({
  delay: z.number().min(0).max(5000).describe("Delay in milliseconds (0-5000)"),
});

// Content type enum for shared use
export const ContentTypeSchema = z.enum(["text", "image", "audio", "resource"]);

// Parameter type enum for shared use
export const ParameterTypeSchema = z.enum(["string", "number", "boolean"]);

// Common response content schema
export const ResponseContentSchema = z.object({
  type: ContentTypeSchema,
  text: z.string().optional(),
  data: z.string().optional(),
  mimeType: z.string().optional(),
});

// Empty schema for tools that don't require input
export const EmptySchema = z.object({});