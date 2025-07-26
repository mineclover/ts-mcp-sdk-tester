import { z } from "zod";

/**
 * Shared Zod schemas for resources domain
 * Common input validation schemas used across resource-related features
 */

// Basic resource registration schema
export const ResourceRegistrationSchema = z.object({
  uri: z.string().describe("The URI for the resource"),
  name: z.string().describe("Name of the resource"),
  description: z.string().optional().describe("Description of the resource"),
});

// Simple resource registration schema
export const SimpleResourceRegistrationSchema = ResourceRegistrationSchema.extend({
  content: z.string().describe("Text content for the resource"),
});

// Template resource registration schema
export const TemplateResourceRegistrationSchema = z.object({
  templateUri: z.string().describe("Template URI pattern (e.g., 'user://{id}')"),
  name: z.string().describe("Name of the resource template"),
  description: z.string().optional().describe("Description of the resource template"),
});

// Rich resource registration schema
export const RichResourceRegistrationSchema = ResourceRegistrationSchema.extend({
  mimeType: z.string().describe("MIME type of the resource content"),
  content: z.string().describe("Content for the resource"),
  metadata: z.record(z.string()).optional().describe("Additional metadata for the resource"),
});

// Resource content type schema
export const ResourceContentTypeSchema = z.enum([
  "text",
  "image",
  "audio",
  "application/json",
  "text/html",
  "text/markdown",
]);

// Empty schema for tools that don't require input
export const EmptySchema = z.object({});

// URI validation schema
export const UriSchema = z.string().url().describe("Valid URI");

// MIME type schema for common types
export const MimeTypeSchema = z
  .enum([
    "text/plain",
    "text/html",
    "text/markdown",
    "application/json",
    "image/png",
    "image/jpeg",
    "audio/wav",
    "audio/mp3",
  ])
  .describe("MIME type for resource content");
