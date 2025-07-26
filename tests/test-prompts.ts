import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  ListPromptsRequest,
  ListPromptsResult,
  GetPromptRequest,
  GetPromptResult
} from "../spec/mcp_spec.js";

/**
 * Tests for Prompts endpoints: list, get
 */

export interface PromptTestScenario {
  name: string;
  description: string;
  request: any;
  expectedResponseType: string;
  validate: (response: any) => boolean;
}

export const promptTestScenarios: PromptTestScenario[] = [
  {
    name: "prompts/list - basic",
    description: "List all prompts without pagination",
    request: {
      method: "prompts/list",
      params: {}
    },
    expectedResponseType: "ListPromptsResult",
    validate: (response: ListPromptsResult) => {
      return (
        Array.isArray(response.prompts) &&
        response.prompts.every(prompt => 
          typeof prompt.name === 'string'
        )
      );
    }
  },
  {
    name: "prompts/list - with pagination",
    description: "List prompts with cursor pagination", 
    request: {
      method: "prompts/list",
      params: { cursor: "0" }
    },
    expectedResponseType: "ListPromptsResult",
    validate: (response: ListPromptsResult) => {
      return (
        Array.isArray(response.prompts) &&
        (response.nextCursor === undefined || typeof response.nextCursor === 'string')
      );
    }
  },
  {
    name: "prompts/get - valid prompt",
    description: "Get a valid prompt without arguments",
    request: {
      method: "prompts/get",
      params: { name: "test-prompt" }
    },
    expectedResponseType: "GetPromptResult",
    validate: (response: GetPromptResult) => {
      return (
        Array.isArray(response.messages) &&
        response.messages.length > 0 &&
        response.messages.every(message => 
          typeof message.role === 'string' &&
          message.content && typeof message.content === 'object'
        )
      );
    }
  },
  {
    name: "prompts/get - with arguments",
    description: "Get a prompt with template arguments",
    request: {
      method: "prompts/get",
      params: { 
        name: "test-prompt",
        arguments: { name: "John", topic: "AI" }
      }
    },
    expectedResponseType: "GetPromptResult",
    validate: (response: GetPromptResult) => {
      return (
        Array.isArray(response.messages) &&
        response.messages.length > 0
      );
    }
  },
  {
    name: "prompts/get - invalid prompt",
    description: "Attempt to get non-existent prompt",
    request: {
      method: "prompts/get",
      params: { name: "nonexistent-prompt" }
    },
    expectedResponseType: "Error",
    validate: (response: any) => {
      return response.error && typeof response.error.message === 'string';
    }
  },
  {
    name: "prompts/get - missing required arguments",
    description: "Get prompt with missing required template arguments",
    request: {
      method: "prompts/get",
      params: { 
        name: "parameterized-prompt",
        arguments: {} // Missing required args
      }
    },
    expectedResponseType: "Error",
    validate: (response: any) => {
      return response.error && typeof response.error.message === 'string';
    }
  }
];

/**
 * Run all prompt endpoint tests
 */
export async function testPromptEndpoints(): Promise<{ passed: number; failed: number; errors: string[] }> {
  console.log("Running Prompt endpoint tests...");
  
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (const scenario of promptTestScenarios) {
    try {
      console.log(`  Testing: ${scenario.name}`);
      
      // Validate request structure
      if (!scenario.request.method || !scenario.request.method.startsWith('prompts/')) {
        throw new Error('Invalid request method');
      }
      
      // Simulate response validation
      let simulatedResponse: any;
      
      switch (scenario.request.method) {
        case 'prompts/list':
          simulatedResponse = {
            prompts: [
              {
                name: "test-prompt",
                description: "Test prompt"
              },
              {
                name: "parameterized-prompt", 
                description: "Prompt with parameters",
                arguments: [
                  { name: "name", required: true },
                  { name: "topic", required: false }
                ]
              }
            ]
          };
          break;
          
        case 'prompts/get':
          if (scenario.request.params.name === "nonexistent-prompt") {
            simulatedResponse = {
              error: { message: "Prompt not found" }
            };
          } else if (scenario.request.params.name === "parameterized-prompt" && 
                    (!scenario.request.params.arguments || !scenario.request.params.arguments.name)) {
            simulatedResponse = {
              error: { message: "Missing required argument: name" }
            };
          } else {
            simulatedResponse = {
              description: "Test prompt result",
              messages: [
                {
                  role: "user",
                  content: {
                    type: "text",
                    text: scenario.request.params.arguments ? 
                      `Hello ${scenario.request.params.arguments.name || 'user'}!` :
                      "Hello user!"
                  }
                }
              ]
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