#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

// Schema mappings from file patterns to SDK schemas
const schemaMappings = {
  'ping.ts': {
    import: 'PingRequestSchema',
    oldPattern: /server\.server\.setRequestHandler\(\s*\{[^}]*method:\s*["']ping["'][^}]*\},/g,
    newPattern: 'server.server.setRequestHandler(PingRequestSchema,'
  },
  'list-tools.ts': {
    import: 'ListToolsRequestSchema',
    oldPattern: /server\.server\.setRequestHandler\(\s*\{[^}]*method:\s*["']tools\/list["'][^}]*\},/g,
    newPattern: 'server.server.setRequestHandler(ListToolsRequestSchema,'
  },
  'call-tool.ts': {
    import: 'CallToolRequestSchema', 
    oldPattern: /server\.server\.setRequestHandler\(\s*\{[^}]*method:\s*["']tools\/call["'][^}]*\},/g,
    newPattern: 'server.server.setRequestHandler(CallToolRequestSchema,'
  },
  'list-prompts.ts': {
    import: 'ListPromptsRequestSchema',
    oldPattern: /server\.server\.setRequestHandler\(\s*\{[^}]*method:\s*["']prompts\/list["'][^}]*\},/g,
    newPattern: 'server.server.setRequestHandler(ListPromptsRequestSchema,'
  },
  'get-prompt.ts': {
    import: 'GetPromptRequestSchema',
    oldPattern: /server\.server\.setRequestHandler\(\s*\{[^}]*method:\s*["']prompts\/get["'][^}]*\},/g,
    newPattern: 'server.server.setRequestHandler(GetPromptRequestSchema,'
  },
  'set-level.ts': {
    import: 'SetLevelRequestSchema',
    oldPattern: /server\.server\.setRequestHandler\(\s*\{[^}]*method:\s*["']logging\/setLevel["'][^}]*\},/g,
    newPattern: 'server.server.setRequestHandler(SetLevelRequestSchema,'
  },
  'complete.ts': {
    import: 'CompleteRequestSchema',
    oldPattern: /server\.server\.setRequestHandler\(\s*\{[^}]*method:\s*["']completion\/complete["'][^}]*\},/g,
    newPattern: 'server.server.setRequestHandler(CompleteRequestSchema,'
  },
  'create-message.ts': {
    import: 'CreateMessageRequestSchema',
    oldPattern: /server\.server\.setRequestHandler\(\s*\{[^}]*method:\s*["']sampling\/createMessage["'][^}]*\},/g,
    newPattern: 'server.server.setRequestHandler(CreateMessageRequestSchema,'
  },
  'create-elicitation.ts': {
    import: 'ElicitRequestSchema',
    oldPattern: /server\.server\.setRequestHandler\(\s*\{[^}]*method:\s*["']elicitation\/create["'][^}]*\},/g,
    newPattern: 'server.server.setRequestHandler(ElicitRequestSchema,'
  },
  'list-roots.ts': {
    import: 'ListRootsRequestSchema',
    oldPattern: /server\.server\.setRequestHandler\(\s*\{[^}]*method:\s*["']roots\/list["'][^}]*\},/g,
    newPattern: 'server.server.setRequestHandler(ListRootsRequestSchema,'
  },
  'initialize.ts': {
    import: 'InitializeRequestSchema',
    oldPattern: /server\.server\.setRequestHandler\(\s*\{[^}]*method:\s*["']initialize["'][^}]*\},/g,
    newPattern: 'server.server.setRequestHandler(InitializeRequestSchema,'
  }
};

// Find all TypeScript files
const files = glob.sync('/Users/junwoobang/mcp/ts-mcp-sdk-tester/features/**/*.ts');

for (const file of files) {
  try {
    let content = readFileSync(file, 'utf8');
    let modified = false;
    
    // Find matching schema mapping
    for (const [pattern, mapping] of Object.entries(schemaMappings)) {
      if (file.includes(pattern)) {
        // Add import if not present
        if (!content.includes(mapping.import)) {
          if (content.includes('from "@modelcontextprotocol/sdk/types.js"')) {
            // Add to existing import
            content = content.replace(
              /import\s*\{([^}]*)\}\s*from\s*"@modelcontextprotocol\/sdk\/types\.js"/,
              `import { $1, ${mapping.import} } from "@modelcontextprotocol/sdk/types.js"`
            );
          } else {
            // Add new import
            content = content.replace(
              /import.*from.*"@modelcontextprotocol\/sdk\/server\/mcp\.js";/,
              `$&\nimport { ${mapping.import} } from "@modelcontextprotocol/sdk/types.js";`
            );
          }
          modified = true;
        }
        
        // Replace setRequestHandler pattern
        if (mapping.oldPattern.test(content)) {
          content = content.replace(mapping.oldPattern, mapping.newPattern);
          modified = true;
        }
        break;
      }
    }
    
    if (modified) {
      writeFileSync(file, content);
      console.log(`Updated: ${file}`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
}

console.log('Schema fix completed!');