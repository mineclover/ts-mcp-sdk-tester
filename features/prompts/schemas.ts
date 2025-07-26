import { z } from "zod";

/**
 * Shared Zod schemas for prompts domain
 * Common input validation schemas used across prompt-related features
 */

// Basic prompt registration schema
export const PromptRegistrationSchema = z.object({
  name: z.string().describe("Name of the prompt to register"),
  description: z.string().describe("Description of the prompt"),
});

// Simple prompt registration schema
export const SimplePromptRegistrationSchema = PromptRegistrationSchema.extend({
  message: z.string().describe("Message content for the prompt"),
});

// Parameterized prompt registration schema
export const ParameterizedPromptRegistrationSchema = PromptRegistrationSchema.extend({
  argName: z.string().describe("Name of the argument"),
  argDescription: z.string().describe("Description of the argument"),
  messageTemplate: z.string().describe("Message template with {argName} placeholder"),
});

// Conversation prompt registration schema
export const ConversationPromptRegistrationSchema = PromptRegistrationSchema.extend({
  systemMessage: z.string().describe("System message for the conversation"),
  userMessage: z.string().describe("User message for the conversation"),
  assistantMessage: z.string().describe("Assistant message for the conversation"),
});

// Dynamic prompt registration schema
export const DynamicPromptRegistrationSchema = PromptRegistrationSchema.extend({
  templateType: z
    .enum(["greeting", "question", "instruction"])
    .describe("Type of template to generate"),
  contextParam: z.string().describe("Parameter name for context"),
  contextDescription: z.string().describe("Description of the context parameter"),
});

// Message role schema
export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);

// Prompt argument type schema
export const PromptArgTypeSchema = z.enum(["string", "number", "boolean", "array"]);

// Empty schema for tools that don't require input
export const EmptySchema = z.object({});

// Template type schema
export const TemplateTypeSchema = z.enum([
  "greeting",
  "question",
  "instruction",
  "summary",
  "analysis",
]);

// Conversation turn schema
export const ConversationTurnSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
});

// Multiple conversation turns schema
export const ConversationSchema = z
  .array(ConversationTurnSchema)
  .min(1)
  .describe("Array of conversation turns");
