import { z } from "zod";

// Primitive schema definitions
export const StringSchemaSchema = z.object({
  type: z.literal("string"),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  minLength: z.optional(z.number()),
  maxLength: z.optional(z.number()),
  format: z.optional(z.enum(["email", "uri", "date", "date-time"])),
});

export const NumberSchemaSchema = z.object({
  type: z.union([z.literal("number"), z.literal("integer")]),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  minimum: z.optional(z.number()),
  maximum: z.optional(z.number()),
});

export const BooleanSchemaSchema = z.object({
  type: z.literal("boolean"),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  default: z.optional(z.boolean()),
});

export const EnumSchemaSchema = z.object({
  type: z.literal("string"),
  title: z.optional(z.string()),
  description: z.optional(z.string()),
  enum: z.array(z.string()),
  enumNames: z.optional(z.array(z.string())),
});

export const PrimitiveSchemaDefinitionSchema = z.union([
  StringSchemaSchema,
  NumberSchemaSchema,
  BooleanSchemaSchema,
  EnumSchemaSchema,
]);

// Elicit request schema
export const ElicitRequestSchema = z.object({
  message: z.string(),
  requestedSchema: z.object({
    type: z.literal("object"),
    properties: z.record(PrimitiveSchemaDefinitionSchema),
    required: z.optional(z.array(z.string())),
  }),
  _meta: z.optional(z.object({}).passthrough()),
});

// Elicit result schema
export const ElicitResultSchema = z.object({
  action: z.enum(["accept", "decline", "cancel"]),
  content: z.optional(z.record(z.union([z.string(), z.number(), z.boolean()]))),
  _meta: z.optional(z.object({}).passthrough()),
});

export type StringSchema = z.infer<typeof StringSchemaSchema>;
export type NumberSchema = z.infer<typeof NumberSchemaSchema>;
export type BooleanSchema = z.infer<typeof BooleanSchemaSchema>;
export type EnumSchema = z.infer<typeof EnumSchemaSchema>;
export type PrimitiveSchemaDefinition = z.infer<typeof PrimitiveSchemaDefinitionSchema>;
export type ElicitRequest = z.infer<typeof ElicitRequestSchema>;
export type ElicitResult = z.infer<typeof ElicitResultSchema>;