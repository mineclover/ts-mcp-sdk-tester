# MCP SDK Tester

A comprehensive testing server for Model Context Protocol (MCP) SDK features. This server exposes all MCP SDK capabilities as tools for testing and validation.

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


# claude code 특징 
tools 의 조회 시점이 claude 를 킨 시점으로 고정됨
이미 그 때 세션 아이디 받아서 tools를 대기시켜두는 형태

즉 인위적으로 세션을 생성시키려하면 header를 주입하지 못하기 때문에 실행되지 않음
그래서 세션을 기억하지 않아도 되는 서버는 stateless 로 구현하는 게 좋음


# mcp 서버 특징

스펙인 것은 따로 구현하지 않아도 McpServer에 구현되 있어서 동작한다 
하지만 그 동작이 mcp 내에서 동작중이라서 메모리 만약 효율적이게 하고 싶다면 내부 데이터 저장 로직과 나머지 로직을 수정해야한다
https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/server/mcp.ts


