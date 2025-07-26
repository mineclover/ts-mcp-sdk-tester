import { z } from "zod";
import { LoggingLevelSchema } from "@modelcontextprotocol/sdk/types.js";

// Re-export from spec
export { LoggingLevelSchema };

// Logging state management
export const LoggingStateSchema = z.object({
  level: LoggingLevelSchema,
  enabled: z.boolean(),
  lastUpdated: z.string(),
});

export type LoggingState = z.infer<typeof LoggingStateSchema>;