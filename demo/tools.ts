/**
 * Demo Tool Data
 * 
 * Sample tools for testing and demonstration purposes.
 * This file contains demo data that can be easily removed or modified.
 */

import type { Tool, CallToolResult, ContentBlock } from "../spec/current_spec.js";

export const DEMO_TOOLS: Tool[] = [
  {
    name: "echo",
    title: "Echo Tool",
    description: "Echoes back the input message",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to echo back",
        },
      },
      required: ["message"],
    },
    annotations: {
      title: "Echo Tool",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "calculator",
    title: "Calculator Tool",
    description: "Performs basic mathematical calculations",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "The operation to perform (add, subtract, multiply, divide)",
        },
        a: {
          type: "number",
          description: "First number",
        },
        b: {
          type: "number",
          description: "Second number",
        },
      },
      required: ["operation", "a", "b"],
    },
    outputSchema: {
      type: "object",
      properties: {
        result: {
          type: "number",
          description: "The calculation result",
        },
        operation: {
          type: "string",
          description: "The operation performed",
        },
      },
    },
    annotations: {
      title: "Calculator Tool",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "file-info",
    title: "File Info Tool",
    description: "Gets information about a file",
    inputSchema: {
      type: "object",
      properties: {
        filepath: {
          type: "string",
          description: "Path to the file to analyze",
        },
      },
      required: ["filepath"],
    },
    annotations: {
      title: "File Info Tool",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "random-number",
    title: "Random Number Generator",
    description: "Generates a random number within a specified range",
    inputSchema: {
      type: "object",
      properties: {
        min: {
          type: "number",
          description: "Minimum value (inclusive)",
        },
        max: {
          type: "number",
          description: "Maximum value (inclusive)",
        },
      },
      required: ["min", "max"],
    },
    annotations: {
      title: "Random Number Generator",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
];

export function executeDemoTool(name: string, args: Record<string, any>): CallToolResult {
  switch (name) {
    case "echo":
      return {
        content: [
          {
            type: "text",
            text: args.message || "No message provided",
          } as ContentBlock,
        ],
      };

    case "calculator":
      const { operation, a, b } = args;
      let result: number;
      
      switch (operation) {
        case "add":
          result = a + b;
          break;
        case "subtract":
          result = a - b;
          break;
        case "multiply":
          result = a * b;
          break;
        case "divide":
          if (b === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: Division by zero",
                } as ContentBlock,
              ],
              isError: true,
            };
          }
          result = a / b;
          break;
        default:
          return {
            content: [
              {
                type: "text",
                text: `Error: Unknown operation '${operation}'. Supported operations: add, subtract, multiply, divide`,
              } as ContentBlock,
            ],
            isError: true,
          };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              result,
              operation,
              calculation: `${a} ${operation} ${b} = ${result}`,
            }, null, 2),
          } as ContentBlock,
        ],
      };

    case "file-info":
      const { filepath } = args;
      
      // Simulate file information
      const info = {
        filepath,
        exists: true,
        size: Math.floor(Math.random() * 10000) + 100,
        type: filepath.includes('.') ? filepath.split('.').pop() : 'unknown',
        lastModified: new Date().toISOString(),
        permissions: 'rw-r--r--',
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(info, null, 2),
          } as ContentBlock,
        ],
      };

    case "random-number":
      const { min, max } = args;
      
      if (min > max) {
        return {
          content: [
            {
              type: "text",
              text: "Error: Minimum value cannot be greater than maximum value",
            } as ContentBlock,
          ],
          isError: true,
        };
      }

      const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              value: randomNum,
              range: { min, max },
              timestamp: new Date().toISOString(),
            }, null, 2),
          } as ContentBlock,
        ],
      };

    default:
      return {
        content: [
          {
            type: "text",
            text: `Error: Tool '${name}' not found`,
          } as ContentBlock,
        ],
        isError: true,
      };
  }
}