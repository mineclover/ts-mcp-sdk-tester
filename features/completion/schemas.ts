import { z } from "zod";

// Completion reference schemas
export const PromptReferenceSchema = z.object({
  type: z.literal("ref/prompt"),
  name: z.string(),
  title: z.optional(z.string()),
});

export const ResourceTemplateReferenceSchema = z.object({
  type: z.literal("ref/resource"),
  uri: z.string(),
});

export const CompletionReferenceSchema = z.union([
  PromptReferenceSchema,
  ResourceTemplateReferenceSchema,
]);

// Completion argument schema
export const CompletionArgumentSchema = z.object({
  name: z.string(),
  value: z.string(),
});

// Completion context schema
export const CompletionContextSchema = z.object({
  arguments: z.optional(z.record(z.string())),
});

// Completion result schema
export const CompletionValuesSchema = z.object({
  values: z.array(z.string()).max(100),
  total: z.optional(z.number()),
  hasMore: z.optional(z.boolean()),
});

export type PromptReference = z.infer<typeof PromptReferenceSchema>;
export type ResourceTemplateReference = z.infer<typeof ResourceTemplateReferenceSchema>;
export type CompletionReference = z.infer<typeof CompletionReferenceSchema>;
export type CompletionArgument = z.infer<typeof CompletionArgumentSchema>;
export type CompletionContext = z.infer<typeof CompletionContextSchema>;
export type CompletionValues = z.infer<typeof CompletionValuesSchema>;