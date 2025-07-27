/**
 * Demo Data Index
 *
 * Central export for all demo data used in the MCP SDK Tester.
 * This file provides easy access to demo resources, tools, prompts, and utilities.
 *
 * To remove demo data:
 * 1. Delete this entire /demo directory
 * 2. Update imports in the standard/ files to remove demo data references
 * 3. Replace demo data with real implementations
 */

// Demo data exports
export { DEMO_RESOURCES, getDemoResourceContent } from "./resources.js";
export { DEMO_PROMPTS, getDemoPromptMessages } from "./prompts.js";
export { DEMO_TOOLS, executeDemoTool } from "./tools.js";
export { generateDemoElicitationContent } from "./elicitation.js";
export { getDemoPromptCompletions, getDemoResourceCompletions } from "./completions.js";
export { generateDemoSamplingResponse } from "./sampling.js";
export { DEMO_ROOTS } from "./roots.js";

// Demo configuration
export const DEMO_CONFIG = {
  enabled: true,
  version: "1.0.0",
  description: "Demo data for MCP SDK Tester - can be safely removed for production use",
} as const;
