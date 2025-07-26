import { z } from "zod";

// Ping schemas
export const PingRequestParamsSchema = z.object({
  _meta: z.object({}).passthrough().optional(),
}).optional();

export const PingResponseSchema = z.object({
  _meta: z.object({}).passthrough().optional(),
});

export type PingRequestParams = z.infer<typeof PingRequestParamsSchema>;
export type PingResponse = z.infer<typeof PingResponseSchema>;