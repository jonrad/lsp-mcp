#!/usr/bin/env node

import { LspClientImpl, startLsp } from "./lsp";
import { startMcp, createMcp } from "./mcp";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getLspMethods, lspMethodHandler, openFileContents } from "./lsp-methods";
import { nullLogger, consoleLogger } from "./logger";
import { Command } from "commander";
import { ToolManager } from "./tool-manager";
import { loadConfig } from "./config";
import { Logger } from "vscode-jsonrpc";
import { Config } from "./config";

async function buildLsps(lsps: Config["lsps"], logger: Logger) {
  /*
  const lsps = [];
  for (const lsp of lsps) {
    const lsp = await startLsp("sh", [
      "-c",
      lspCommand
    ], logger);
  }
  */
}

async function mainConfig(
  configPath: string,
  methods: string[] | undefined = undefined,
  verbose: boolean = false,
) {
  const logger = verbose ? consoleLogger : nullLogger;
  const config = await loadConfig(configPath);
  const lspMethods = await getLspMethods(methods);

  const lsps = buildLsps(config.lsps, logger);
  for (const lspConfig of config.lsps) {
    const toolManager = new ToolManager(logger);

    const lsp = await startLsp(lspConfig.command, lspConfig.args, logger);
  }
}

async function main(methods: string[] | undefined = undefined, lspCommand: string, verbose: boolean) {
  const logger = verbose ? consoleLogger : nullLogger;

  const toolManager = new ToolManager(logger);
  const lspMethods = await getLspMethods(methods);

  const lsp = new LspClientImpl("sh", ["-c", lspCommand], logger);
  await lsp.start();

  toolManager.registerTool({
    id: "file_contents_to_uri",
    description: "Creates a URI given some file contents to be used in the LSP methods that require a URI",
    inputSchema: {
      type: "object" as "object",
      properties: {
        file_contents: {
          type: "string",
          description: "The contents of the file",
        },
      },
    },
    handler: async (args) => {
      const { file_contents } = args;
      const uri = `mem://${Math.random().toString(36).substring(2, 15)}`;

      await openFileContents(lsp, uri, file_contents);

      return uri;
    },
  });

  lspMethods.forEach((method) => {
    const id = method.id
    toolManager.registerTool({
      id: method.id.replace("/", "_"),
      description: method.description,
      inputSchema: method.inputSchema,
      handler: (args) => lspMethodHandler(id, lsp, args)
    });
  });

  const mcp = createMcp();

  const dispose = async () => {
    lsp.dispose();
    await mcp.close();
  }

  process.on('SIGINT', dispose);
  process.on('SIGTERM', dispose);
  process.on('exit', dispose);

  mcp.setRequestHandler(ListToolsRequestSchema, async () => {
    const mcpTools = toolManager.getTools().map((tool) => ({
      name: tool.id,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return {
      tools: mcpTools,
    };
  });

  mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!args) {
      throw new Error("No arguments");
    }

    const result = await toolManager.callTool(name, args);

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  });

  await startMcp(mcp);
}

const program = new Command();

program
  .name("lsp-mcp")
  .description("A tool for providing LSP requests to MCP")
  .version("0.1.0")
  .option("-m, --methods [string...]", "LSP methods to enabled (Default: all)")
  .option(
    "-l, --lsp [string]",
    "LSP command to start (note: command is passed through sh -c)",
    // TODO: move this to package.json or something
    `npx -y typescript-language-server --stdio`
  )
  .option("-v, --verbose", "Verbose output (Dev only, don't use with MCP)")
  .option("-c, --config [string]", "Path to config file")
  .parse(process.argv);

const options = program.opts();

if (options.config) {
  mainConfig(options.config, options.methods, options.verbose);
} else {
  main(options.methods, options.lsp, options.verbose);
}

