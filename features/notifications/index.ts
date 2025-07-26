import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Import individual notification tools
import { registerSendResourceListChanged } from './send-resource-list-changed.js';
import { registerSendToolListChanged } from './send-tool-list-changed.js';
import { registerSendPromptListChanged } from './send-prompt-list-changed.js';
import { registerSendAllListChanged } from './send-all-list-changed.js';
import { registerTestNotificationTiming } from './test-notification-timing.js';
import { registerTestNotificationAfterRegistration } from './test-notification-after-registration.js';

/**
 * Notification Testing Features
 * Tests list change notifications and custom notifications
 */

export function registerNotificationFeatures(server: McpServer) {
  // Register all notification testing tools
  registerSendResourceListChanged(server);
  registerSendToolListChanged(server);
  registerSendPromptListChanged(server);
  registerSendAllListChanged(server);
  registerTestNotificationTiming(server);
  registerTestNotificationAfterRegistration(server);
}