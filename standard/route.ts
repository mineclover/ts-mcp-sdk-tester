import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDemoEndpoints } from "../examples/simpleStreamableHttp";

export function registerEndpoints(server: McpServer) {


    registerDemoEndpoints(server);

}