/**
 * Demo Prompt Data
 *
 * Sample prompts for testing and demonstration purposes.
 * This file contains demo data that can be easily removed or modified.
 */

import type { Prompt, PromptMessage, ContentBlock } from "../spec/current_spec.js";

export const DEMO_PROMPTS: Prompt[] = [
  {
    name: "greeting",
    title: "Greeting Prompt",
    description: "A simple greeting prompt template",
    arguments: [
      {
        name: "name",
        title: "Name",
        description: "The name to greet",
        required: true,
      },
    ],
  },
  {
    name: "code-review",
    title: "Code Review Prompt",
    description: "Prompt for reviewing code changes",
    arguments: [
      {
        name: "language",
        title: "Programming Language",
        description: "The programming language of the code",
        required: true,
      },
      {
        name: "context",
        title: "Context",
        description: "Additional context for the review",
        required: false,
      },
    ],
  },
  {
    name: "simple-prompt",
    title: "Simple Prompt",
    description: "A basic prompt without arguments",
  },
  {
    name: "summarize",
    title: "Text Summarization",
    description: "Summarize text content",
    arguments: [
      {
        name: "text",
        title: "Text to Summarize",
        description: "The text content to be summarized",
        required: true,
      },
      {
        name: "length",
        title: "Summary Length",
        description: "Desired length of the summary (short, medium, long)",
        required: false,
      },
    ],
  },
];

export function getDemoPromptMessages(
  name: string,
  args: Record<string, string> = {}
): PromptMessage[] {
  switch (name) {
    case "greeting":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Hello, ${args.name || "World"}! How are you today?`,
          } as ContentBlock,
        },
      ];

    case "code-review":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please review this ${args.language || "code"} for best practices, bugs, and improvements.${
              args.context ? ` Context: ${args.context}` : ""
            }`,
          } as ContentBlock,
        },
      ];

    case "simple-prompt":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: "This is a simple prompt without any arguments.",
          } as ContentBlock,
        },
      ];

    case "summarize": {
      const length = args.length || "medium";
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please provide a ${length} summary of the following text:\n\n${args.text || "No text provided"}`,
          } as ContentBlock,
        },
      ];
    }

    default:
      throw new Error(`Prompt not found: ${name}`);
  }
}
