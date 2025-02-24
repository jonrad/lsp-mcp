import { startLsp } from "./lsp";
import { startMcp, createMcp } from "./mcp";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getTools } from "./lsp-tools";
import { nullLogger } from "./logger";

async function main() {
  const lsp = await startLsp("sh", [
    "-c",
    "yarn --silent typescript-language-server --stdio --log-level 4 | tee lsp.log",
  ], nullLogger);

  const tools = getTools();
  const toolLookup = new Map(tools.map((tool) => [tool.name, tool]));

  const mcp = createMcp();
  mcp.setRequestHandler(ListToolsRequestSchema, async () => {
    const mcpTools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return {
      tools: mcpTools,
    };
  });

  mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    if (!args) {
      throw new Error("No arguments")
    }
   
    const tool = toolLookup.get(name)
    if (!tool) {
      throw new Error("Unknown tool")
    }
   
    const result = await tool.handler(lsp, args)
   
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  await startMcp(mcp);
}

main();
