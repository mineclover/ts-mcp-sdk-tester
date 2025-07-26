import { z } from "zod";

// Content block schemas
export const TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  annotations: z.optional(z.object({}).passthrough()),
  _meta: z.optional(z.object({}).passthrough()),
});

export const ImageContentSchema = z.object({
  type: z.literal("image"),
  data: z.string(),
  mimeType: z.string(),
  annotations: z.optional(z.object({}).passthrough()),
  _meta: z.optional(z.object({}).passthrough()),
});

export const AudioContentSchema = z.object({
  type: z.literal("audio"),
  data: z.string(),
  mimeType: z.string(),
  annotations: z.optional(z.object({}).passthrough()),
  _meta: z.optional(z.object({}).passthrough()),
});

export const ContentBlockSchema = z.union([
  TextContentSchema,
  ImageContentSchema,
  AudioContentSchema,
]);

// Sampling message schema
export const SamplingMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: ContentBlockSchema,
});

// Model preferences schema
export const ModelHintSchema = z.object({
  name: z.optional(z.string()),
});

export const ModelPreferencesSchema = z.object({
  hints: z.optional(z.array(ModelHintSchema)),
  costPriority: z.optional(z.number().min(0).max(1)),
  speedPriority: z.optional(z.number().min(0).max(1)),
  intelligencePriority: z.optional(z.number().min(0).max(1)),
});

// Create message request schema
export const CreateMessageRequestSchema = z.object({
  messages: z.array(SamplingMessageSchema),
  modelPreferences: z.optional(ModelPreferencesSchema),
  systemPrompt: z.optional(z.string()),
  includeContext: z.optional(z.enum(["none", "thisServer", "allServers"])),
  temperature: z.optional(z.number()),
  maxTokens: z.number(),
  stopSequences: z.optional(z.array(z.string())),
  metadata: z.optional(z.object({}).passthrough()),
  _meta: z.optional(z.object({}).passthrough()),
});

// Create message result schema
export const CreateMessageResultSchema = SamplingMessageSchema.extend({
  model: z.string(),
  stopReason: z.optional(z.enum(["endTurn", "stopSequence", "maxTokens"]).or(z.string())),
  _meta: z.optional(z.object({}).passthrough()),
});

export type TextContent = z.infer<typeof TextContentSchema>;
export type ImageContent = z.infer<typeof ImageContentSchema>;
export type AudioContent = z.infer<typeof AudioContentSchema>;
export type ContentBlock = z.infer<typeof ContentBlockSchema>;
export type SamplingMessage = z.infer<typeof SamplingMessageSchema>;
export type ModelHint = z.infer<typeof ModelHintSchema>;
export type ModelPreferences = z.infer<typeof ModelPreferencesSchema>;
export type CreateMessageRequest = z.infer<typeof CreateMessageRequestSchema>;
export type CreateMessageResult = z.infer<typeof CreateMessageResultSchema>;