import { z } from "zod";

// Implementation schema
export const ImplementationSchema = z.object({
  name: z.string(),
  title: z.optional(z.string()),
  version: z.string(),
});

// Client capabilities schema
export const ClientCapabilitiesSchema = z.object({
  experimental: z.optional(z.object({}).passthrough()),
  roots: z.optional(z.object({
    listChanged: z.optional(z.boolean()),
  }).passthrough()),
  sampling: z.optional(z.object({}).passthrough()),
  elicitation: z.optional(z.object({}).passthrough()),
});

// Server capabilities schema
export const ServerCapabilitiesSchema = z.object({
  experimental: z.optional(z.object({}).passthrough()),
  logging: z.optional(z.object({}).passthrough()),
  completions: z.optional(z.object({}).passthrough()),
  prompts: z.optional(z.object({
    listChanged: z.optional(z.boolean()),
  }).passthrough()),
  resources: z.optional(z.object({
    subscribe: z.optional(z.boolean()),
    listChanged: z.optional(z.boolean()),
  }).passthrough()),
  tools: z.optional(z.object({
    listChanged: z.optional(z.boolean()),
  }).passthrough()),
});

// Initialize request schema
export const InitializeRequestSchema = z.object({
  protocolVersion: z.string(),
  capabilities: ClientCapabilitiesSchema,
  clientInfo: ImplementationSchema,
  _meta: z.optional(z.object({}).passthrough()),
});

// Initialize result schema
export const InitializeResultSchema = z.object({
  protocolVersion: z.string(),
  capabilities: ServerCapabilitiesSchema,
  serverInfo: ImplementationSchema,
  instructions: z.optional(z.string()),
  _meta: z.optional(z.object({}).passthrough()),
});

export type Implementation = z.infer<typeof ImplementationSchema>;
export type ClientCapabilities = z.infer<typeof ClientCapabilitiesSchema>;
export type ServerCapabilities = z.infer<typeof ServerCapabilitiesSchema>;
export type InitializeRequest = z.infer<typeof InitializeRequestSchema>;
export type InitializeResult = z.infer<typeof InitializeResultSchema>;