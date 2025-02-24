import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Create an MCP server
export function createMcp() {
  return new McpServer(
    {
      name: "LSP",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );
}

// Start receiving messages on stdin and sending messages on stdout
export async function startMcp(mcp: McpServer) {
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}
