import { z } from "zod";

// Root schema
export const RootSchema = z.object({
  uri: z.string(),
  name: z.optional(z.string()),
  _meta: z.optional(z.object({}).passthrough()),
});

// List roots request schema
export const ListRootsRequestSchema = z.object({
  _meta: z.optional(z.object({}).passthrough()),
}).optional();

// List roots result schema
export const ListRootsResultSchema = z.object({
  roots: z.array(RootSchema),
  _meta: z.optional(z.object({}).passthrough()),
});

export type Root = z.infer<typeof RootSchema>;
export type ListRootsRequest = z.infer<typeof ListRootsRequestSchema>;
export type ListRootsResult = z.infer<typeof ListRootsResultSchema>;