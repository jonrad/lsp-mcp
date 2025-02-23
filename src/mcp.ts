import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export function createMcp() {
  // Create an MCP server
  return new McpServer({
    name: "LSP",
    version: "0.1.0",
    description: "A language server protocol server",
  });
}

export async function startMcp(mcp: McpServer) {
  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}
