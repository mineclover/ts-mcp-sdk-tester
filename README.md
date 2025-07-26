# MCP SDK Tester

A comprehensive testing server for Model Context Protocol (MCP) SDK features. This server exposes all MCP SDK capabilities as tools for testing and validation.

## Features

- **Complete MCP SDK Testing**: Test all server capabilities including resources, tools, prompts, and notifications
- **Dual Transport Support**: Both stdio (standard) and HTTP+SSE transports
- **Dynamic Registration**: Register and test resources, tools, and prompts at runtime
- **Web Interface**: Built-in web interface for easy testing and documentation
- **Standard Implementation**: Uses Express.js with proper CORS and session management

## Build the server

```bash
bun run build
```

## Development Mode

For development and testing without building:

```bash
# Run the server directly with Bun (stdio mode)
bun run index.ts

# Run with HTTP server on custom port
bun run index.ts --port 3000
bun run index.ts -p 8080

# Force HTTP mode (default port 3000)
bun run index.ts --http

# Force stdio mode (default)
bun run index.ts --stdio

# Use with inspector for testing (default port 5173)
npx @modelcontextprotocol/inspector bun run index.ts

# Change inspector port if needed
npx @modelcontextprotocol/inspector --port 8080 bun run index.ts

# Connect inspector to HTTP server
npx @modelcontextprotocol/inspector http://localhost:3000/sse
```

## Testing and Debugging

### Using Inspector with Stdio Mode (Default)

```bash
# You can use [inspector](https://github.com/modelcontextprotocol/inspector) for testing and debugging.
package_name=$(bun run show-package-name)
npx @modelcontextprotocol/inspector dist/$package_name

# Or for development mode
npx @modelcontextprotocol/inspector bun run index.ts

# Change inspector port if needed
npx @modelcontextprotocol/inspector --port 8080 bun run index.ts
```

### Using Inspector with HTTP Mode

```bash
# Start server in HTTP mode
bun run index.ts --port 3000

# Then connect inspector to HTTP endpoint
npx @modelcontextprotocol/inspector http://localhost:3000/sse

# Or with built version
dist/mcp-sdk-tester --port 3000
# In another terminal:
npx @modelcontextprotocol/inspector http://localhost:3000/sse
```

### Available Server Options

- `--port 3000` or `-p 3000`: Run HTTP server on specified port
- `--http`: Force HTTP mode (default port 3000)  
- `--stdio`: Force stdio mode (default)
- No arguments: Default stdio mode for MCP inspector compatibility

## Available Testing Tools

The server provides comprehensive testing tools for all MCP SDK features:

### Server State Tools
- `check_server_connection` - Check if the server is connected to a transport

### Resource Management Tools
- `register_simple_resource` - Register a static resource with URI, name, and content
- `list_registered_resources` - List all registered resources

### Tool Management Tools
- `register_simple_tool` - Register a simple tool with no parameters
- `register_parameterized_tool` - Register a tool with typed parameters (string/number/boolean)
- `list_registered_tools` - List all registered tools

### Prompt Management Tools
- `register_simple_prompt` - Register a simple prompt with no arguments
- `register_parameterized_prompt` - Register a prompt with arguments and templates
- `list_registered_prompts` - List all registered prompts

### Notification Testing Tools
- `send_resource_list_changed` - Test resource list change notifications
- `send_tool_list_changed` - Test tool list change notifications
- `send_prompt_list_changed` - Test prompt list change notifications

### Comprehensive Testing
- `run_comprehensive_test` - Run all major MCP server features in sequence

## Install

```bash
# Install the command to $HOME/bin or your preferred path
cp dist/$package_name $HOME/bin/
```
