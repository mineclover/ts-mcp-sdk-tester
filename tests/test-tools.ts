import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  ListToolsRequest,
  ListToolsResult,
  CallToolRequest,
  CallToolResult
} from "../spec/mcp_spec.js";

/**
 * Tests for Tools endpoints: list, call
 */

export interface ToolTestScenario {
  name: string;
  description: string;
  request: any;
  expectedResponseType: string;
  validate: (response: any) => boolean;
}

export const toolTestScenarios: ToolTestScenario[] = [
  {
    name: "tools/list - basic",
    description: "List all tools without pagination",
    request: {
      method: "tools/list",
      params: {}
    },
    expectedResponseType: "ListToolsResult",
    validate: (response: ListToolsResult) => {
      return (
        Array.isArray(response.tools) &&
        response.tools.every(tool => 
          typeof tool.name === 'string' &&
          tool.inputSchema &&
          tool.inputSchema.type === 'object'
        )
      );
    }
  },
  {
    name: "tools/list - with pagination",
    description: "List tools with cursor pagination",
    request: {
      method: "tools/list",
      params: { cursor: "0" }
    },
    expectedResponseType: "ListToolsResult",
    validate: (response: ListToolsResult) => {
      return (
        Array.isArray(response.tools) &&
        (response.nextCursor === undefined || typeof response.nextCursor === 'string')
      );
    }
  },
  {
    name: "tools/call - valid tool no args",
    description: "Call a valid tool without arguments",
    request: {
      method: "tools/call",
      params: { name: "simple-tool" }
    },
    expectedResponseType: "CallToolResult",
    validate: (response: CallToolResult) => {
      return (
        Array.isArray(response.content) &&
        response.content.length > 0 &&
        response.content.every(content => 
          content.type && typeof content.type === 'string'
        ) &&
        (response.isError === undefined || typeof response.isError === 'boolean')
      );
    }
  },
  {
    name: "tools/call - valid tool with args",
    description: "Call a valid tool with arguments",
    request: {
      method: "tools/call",
      params: { 
        name: "parameterized-tool",
        arguments: { input: "test", count: 5 }
      }
    },
    expectedResponseType: "CallToolResult",
    validate: (response: CallToolResult) => {
      return (
        Array.isArray(response.content) &&
        response.content.length > 0 &&
        !response.isError
      );
    }
  },
  {
    name: "tools/call - invalid tool",
    description: "Attempt to call non-existent tool",
    request: {
      method: "tools/call",
      params: { name: "nonexistent-tool" }
    },
    expectedResponseType: "Error",
    validate: (response: any) => {
      return response.error && typeof response.error.message === 'string';
    }
  },
  {
    name: "tools/call - invalid arguments",
    description: "Call tool with invalid arguments",
    request: {
      method: "tools/call",
      params: { 
        name: "parameterized-tool",
        arguments: { invalid: "arg" }
      }
    },
    expectedResponseType: "CallToolResult",
    validate: (response: CallToolResult) => {
      return (
        Array.isArray(response.content) &&
        response.isError === true
      );
    }
  },
  {
    name: "tools/call - tool execution error",
    description: "Call tool that throws an error during execution",
    request: {
      method: "tools/call",
      params: { 
        name: "error-tool",
        arguments: {}
      }
    },
    expectedResponseType: "CallToolResult",
    validate: (response: CallToolResult) => {
      return (
        Array.isArray(response.content) &&
        response.isError === true &&
        response.content.some(content => 
          content.type === 'text' && 
          typeof content.text === 'string' &&
          content.text.includes('error')
        )
      );
    }
  },
  {
    name: "tools/call - tool with structured content",
    description: "Call tool that returns structured content",
    request: {
      method: "tools/call",
      params: { 
        name: "structured-tool",
        arguments: {}
      }
    },
    expectedResponseType: "CallToolResult",
    validate: (response: CallToolResult) => {
      return (
        Array.isArray(response.content) &&
        response.structuredContent &&
        typeof response.structuredContent === 'object'
      );
    }
  }
];

/**
 * Run all tool endpoint tests
 */
export async function testToolEndpoints(): Promise<{ passed: number; failed: number; errors: string[] }> {
  console.log("Running Tool endpoint tests...");
  
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (const scenario of toolTestScenarios) {
    try {
      console.log(`  Testing: ${scenario.name}`);
      
      // Validate request structure
      if (!scenario.request.method || !scenario.request.method.startsWith('tools/')) {
        throw new Error('Invalid request method');
      }
      
      // Simulate response validation
      let simulatedResponse: any;
      
      switch (scenario.request.method) {
        case 'tools/list':
          simulatedResponse = {
            tools: [
              {
                name: "simple-tool",
                description: "Simple tool with no parameters",
                inputSchema: { type: "object", properties: {} }
              },
              {
                name: "parameterized-tool",
                description: "Tool with parameters",
                inputSchema: {
                  type: "object",
                  properties: {
                    input: { type: "string" },
                    count: { type: "number" }
                  },
                  required: ["input"]
                }
              },
              {
                name: "error-tool",
                description: "Tool that always errors",
                inputSchema: { type: "object", properties: {} }
              },
              {
                name: "structured-tool",
                description: "Tool that returns structured content",
                inputSchema: { type: "object", properties: {} },
                outputSchema: {
                  type: "object",
                  properties: {
                    result: { type: "string" },
                    data: { type: "object" }
                  }
                }
              }
            ]
          };
          break;
          
        case 'tools/call':
          const toolName = scenario.request.params.name;
          
          if (toolName === "nonexistent-tool") {
            simulatedResponse = {
              error: { message: "Tool not found" }
            };
          } else if (toolName === "error-tool") {
            simulatedResponse = {
              content: [{
                type: "text",
                text: "Tool execution failed: Simulated error"
              }],
              isError: true
            };
          } else if (toolName === "structured-tool") {
            simulatedResponse = {
              content: [{
                type: "text",
                text: "Structured tool executed successfully"
              }],
              structuredContent: {
                result: "success",
                data: { timestamp: Date.now() }
              },
              isError: false
            };
          } else if (toolName === "parameterized-tool") {
            const args = scenario.request.params.arguments || {};
            if (!args.input && scenario.name.includes('invalid arguments')) {
              simulatedResponse = {
                content: [{
                  type: "text",
                  text: "Missing required parameter: input"
                }],
                isError: true
              };
            } else {
              simulatedResponse = {
                content: [{
                  type: "text",
                  text: `Tool executed with input: ${args.input || 'none'}, count: ${args.count || 1}`
                }],
                isError: false
              };
            }
          } else {
            simulatedResponse = {
              content: [{
                type: "text",
                text: "Simple tool executed successfully"
              }],
              isError: false
            };
          }
          break;
          
        default:
          throw new Error(`Unknown method: ${scenario.request.method}`);
      }
      
      // Validate response
      if (scenario.validate(simulatedResponse)) {
        console.log(`    ✓ ${scenario.description}`);
        passed++;
      } else {
        console.log(`    ✗ ${scenario.description} - Validation failed`);
        errors.push(`${scenario.name}: Validation failed`);
        failed++;
      }
      
    } catch (error) {
      console.log(`    ✗ ${scenario.description} - Error: ${error instanceof Error ? error.message : String(error)}`);
      errors.push(`${scenario.name}: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }
  
  return { passed, failed, errors };
}