import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Import individual content tools
import { registerTestContentTypes } from './test-content-types.js';
import { registerTestMixedContent } from './test-mixed-content.js';
import { registerTestLargeContent } from './test-large-content.js';
import { registerTestContentMetadata } from './test-content-metadata.js';

/**
 * Content Type Testing Features
 * Tests different content types: text, image, audio, resource
 */

export function registerContentFeatures(server: McpServer) {
  // Register all content testing tools
  registerTestContentTypes(server);
  registerTestMixedContent(server);
  registerTestLargeContent(server);
  registerTestContentMetadata(server);
}