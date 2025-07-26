import { z } from "zod";

/**
 * Shared Zod schemas for content domain
 * Common input validation schemas used across content-related features
 */

// Content type schema
export const ContentTypeSchema = z.enum(["text", "image", "audio", "resource"]);

// Content testing schema
export const ContentTestSchema = z.object({
  contentType: z
    .enum(["text", "image", "audio", "resource", "all"])
    .describe("Type of content to test"),
});

// Mixed content testing schema
export const MixedContentTestSchema = z.object({
  textContent: z.string().describe("Text content to include"),
  imageContent: z.string().optional().describe("Base64 image content (optional)"),
  audioContent: z.string().optional().describe("Base64 audio content (optional)"),
  resourceUri: z.string().optional().describe("Resource URI to include (optional)"),
});

// Large content testing schema
export const LargeContentTestSchema = z.object({
  contentSize: z.enum(["small", "medium", "large", "huge"]).describe("Size of content to generate"),
  contentType: ContentTypeSchema.describe("Type of large content"),
});

// Content metadata testing schema
export const ContentMetadataTestSchema = z.object({
  contentType: ContentTypeSchema.describe("Type of content"),
  includeMetadata: z.boolean().describe("Whether to include metadata"),
  customMimeType: z.string().optional().describe("Custom MIME type (optional)"),
});

// MIME type schema for content
export const MimeTypeSchema = z.enum([
  "text/plain",
  "text/html",
  "text/markdown",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/gif",
  "audio/wav",
  "audio/mp3",
  "audio/ogg",
  "video/mp4",
  "application/pdf",
]);

// Content size options
export const ContentSizeSchema = z.enum(["small", "medium", "large", "huge"]);

// Base64 data schema
export const Base64DataSchema = z
  .string()
  .regex(/^[A-Za-z0-9+/]*={0,2}$/)
  .describe("Base64 encoded data");

// Empty schema for tools that don't require input
export const EmptySchema = z.object({});

// Content encoding schema
export const ContentEncodingSchema = z.enum(["base64", "utf8", "binary"]);

// Content validation schema
export const ContentValidationSchema = z.object({
  type: ContentTypeSchema,
  encoding: ContentEncodingSchema.optional(),
  mimeType: MimeTypeSchema.optional(),
  size: z.number().min(0).optional(),
  metadata: z.record(z.string()).optional(),
});
