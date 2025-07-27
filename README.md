# MCP SDK Tester

A comprehensive testing server for Model Context Protocol (MCP) SDK features. This server exposes all MCP SDK capabilities as tools for testing and validation.

## Features

- **Complete MCP SDK Testing**: Test all server capabilities including resources, tools, prompts, and notifications
- **Dual Transport Support**: Both stdio (standard) and HTTP+SSE transports
- **Dynamic Registration**: Register and test resources, tools, and prompts at runtime
- **Web Interface**: Built-in web interface for easy testing and documentation
- **Standard Implementation**: Uses Express.js with proper CORS and session management
- **Lifecycle Management**: Complete MCP lifecycle implementation with session isolation support

## Documentation

- [Lifecycle Management](./docs/lifecycle.md) - MCP 라이프사이클 관리 및 세션 격리

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

# Force stdio mode (default)
bun run index.ts --stdio

# Use with inspector for testing stdio
npx @modelcontextprotocol/inspector bun run index.ts

# Change inspector port if needed
# CLIENT_PORT = inspector web , SERVER_PORT = inspector proxy   
CLIENT_PORT=3000 SERVER_PORT=6000 npx @modelcontextprotocol/inspector

# Connect inspector to HTTP server
npx @modelcontextprotocol/inspector http://localhost:3000/mcp
```

Transport Type steamable HTTP를 테스트 하려면, `bun run index.ts --port 3000` 로 서버를 따로 켜야 함


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



```
claude mcp add --transport http mcp-example http://localhost:3000/mcp
```

settings.local.json
```
  "permissions": {
    "allow": [
    "mcp__mcp-protocol",
    "WebFetch(domain:raw.githubusercontent.com)",
    "WebFetch(domain:spec.modelcontextprotocol.io)",
    "WebFetch(domain:modelcontextprotocol.io)"
    ]
  }
```

