import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Import individual prompt tools
import { registerRegisterSimplePrompt } from './register-simple-prompt.js';
import { registerRegisterParameterizedPrompt } from './register-parameterized-prompt.js';
import { registerRegisterConversationPrompt } from './register-conversation-prompt.js';
import { registerRegisterDynamicPrompt } from './register-dynamic-prompt.js';
import { registerListRegisteredPrompts } from './list-registered-prompts.js';

/**
 * Prompt Management Features
 * Tests simple prompts, parameterized prompts, and prompt lifecycle
 */

export function registerPromptFeatures(server: McpServer) {
  // Register all prompt management tools
  registerRegisterSimplePrompt(server);
  registerRegisterParameterizedPrompt(server);
  registerRegisterConversationPrompt(server);
  registerRegisterDynamicPrompt(server);
  registerListRegisteredPrompts(server);
}

// Re-export shared state for cross-tool access
export { registeredPrompts } from './register-simple-prompt.js';