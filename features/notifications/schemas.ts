import { z } from 'zod';

/**
 * Shared Zod schemas for notifications domain
 * Common input validation schemas used across notification-related features
 */

// Notification timing test schema
export const NotificationTimingTestSchema = z.object({
  count: z.number().min(1).max(10).describe("Number of notifications to send"),
  interval: z.number().min(100).max(5000).describe("Interval between notifications (ms)"),
  type: z.enum(["resources", "tools", "prompts", "all"]).describe("Type of notifications to send"),
});

// Notification type schema
export const NotificationTypeSchema = z.enum(["resource", "tool", "prompt", "all"]);

// Resource registration for notification schema
export const NotificationResourceRegistrationSchema = z.object({
  resourceName: z.string().describe("Name of the resource to register"),
  resourceUri: z.string().describe("URI of the resource"),
  resourceDescription: z.string().optional().describe("Description of the resource"),
  sendNotification: z.boolean().default(true).describe("Whether to send notification after registration"),
});

// Tool registration for notification schema  
export const NotificationToolRegistrationSchema = z.object({
  toolName: z.string().describe("Name of the tool to register"),
  toolDescription: z.string().describe("Description of the tool"),
  sendNotification: z.boolean().default(true).describe("Whether to send notification after registration"),
});

// Prompt registration for notification schema
export const NotificationPromptRegistrationSchema = z.object({
  promptName: z.string().describe("Name of the prompt to register"),
  promptDescription: z.string().describe("Description of the prompt"),
  sendNotification: z.boolean().default(true).describe("Whether to send notification after registration"),
});

// Notification batch test schema
export const NotificationBatchTestSchema = z.object({
  batchSize: z.number().min(1).max(10).describe("Number of notifications to send in batch"),
  batchType: NotificationTypeSchema.describe("Type of notifications to send"),
  intervalMs: z.number().min(0).max(5000).describe("Interval between notifications in milliseconds"),
});

// Empty schema for tools that don't require input
export const EmptySchema = z.object({});

// Delay schema for timing tests
export const DelaySchema = z.number().min(0).max(10000).describe("Delay in milliseconds");

// Boolean flag schema
export const BooleanFlagSchema = z.boolean().default(true);

// Notification priority schema
export const NotificationPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

// Notification metadata schema
export const NotificationMetadataSchema = z.object({
  timestamp: z.string().optional(),
  source: z.string().optional(),
  priority: NotificationPrioritySchema.optional(),
  metadata: z.record(z.string()).optional(),
});