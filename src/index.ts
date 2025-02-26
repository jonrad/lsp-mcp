#!/usr/bin/env node

import { LspClient, LspClientImpl, startLsp } from "./lsp";
import { startMcp, createMcp } from "./mcp";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getLspMethods, lspMethodHandler, openFileContents } from "./lsp-methods";
import { nullLogger, consoleLogger, errorLogger } from "./logger";
import { Command } from "commander";
import { ToolManager } from "./tool-manager";
import { loadConfig } from "./config";
import { Logger } from "vscode-jsonrpc";
import { Config } from "./config";
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { JSONSchema4 } from "json-schema";
class LspManager {
  private readonly lsps: Map<string, LspMeta>;
  private readonly languageToLsp: Map<string, LspMeta>;
  private readonly extensionToLsp: Map<string, LspMeta>;

  constructor(lsps: LspMeta[]) {
    this.lsps = new Map(lsps.map((lsp) => [lsp.id, lsp]));

    // Build language lookup map
    this.languageToLsp = new Map();
    this.extensionToLsp = new Map();
    for (const lsp of lsps) {
      for (const language of lsp.languages) {
        // TODO: handle conflict
        this.languageToLsp.set(language.toLowerCase(), lsp);
      }

      for (const extension of lsp.extensions) {
        // TODO: handle conflict
        this.extensionToLsp.set(extension.toLowerCase(), lsp);
      }
    }
  }

  getLsp(id: string): LspClient | undefined {
    return this.lsps.get(id)?.lsp;
  }

  getLsps(): LspClient[] {
    return Array.from(this.lsps.values()).map((lsp) => lsp.lsp);
  }

  getLspByLanguage(language: string): LspClient | undefined {
    return this.languageToLsp.get(language.toLowerCase())?.lsp;
  }

  getLspByExtension(extension: string): LspClient | undefined {
    return this.extensionToLsp.get(extension.toLowerCase())?.lsp;
  }
}

interface LspMeta {
  id: string;
  extensions: string[];
  languages: string[];
  lsp: LspClient;
}

let lsps: LspManager | undefined;
let mcp: McpServer | undefined;

function dispose() {
  if (lsps !== undefined) {
    lsps.getLsps().forEach((lsp) => lsp.dispose());
  }

  if (mcp !== undefined) {
    mcp.close();
  }
}


function buildLsps(lspConfigs: Config["lsps"], logger: Logger): LspMeta[] {
  return lspConfigs.map((lspConfig) => ({
    id: lspConfig.id,
    extensions: lspConfig.extensions,
    languages: lspConfig.languages,
    lsp: new LspClientImpl(lspConfig.command, lspConfig.args, logger)
  }));
}

async function mainConfig(
  configPath: string,
  methods: string[] | undefined = undefined,
  verbose: boolean = false,
) {
  const logger = verbose ? errorLogger : nullLogger;
  const config = await loadConfig(configPath);

  const toolManager = new ToolManager(logger);
  const lspMethods = await getLspMethods(methods);

  const lsps = new LspManager(buildLsps(config.lsps, logger));

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
        programming_language: {
          type: "string",
          description: "The programming language of the file",
        },
      },
    },
    handler: async (args) => {
      const { file_contents, programming_language } = args;
      const uri = `mem://${Math.random().toString(36).substring(2, 15)}`;
      const lsp = lsps.getLspByLanguage(programming_language);
      if (!lsp) {
        throw new Error(`No LSP found for language: ${programming_language}`);
      }

      await openFileContents(lsp, uri, file_contents);

      return uri;
    },
  });

  // TODO!!! REMOVE
  await Promise.all(lsps.getLsps().map((lsp) => lsp.start()));

  mcp = createMcp();

  lspMethods.forEach((method) => {
    const id = method.id
    const inputSchema: JSONSchema4 = {
      ...method.inputSchema,
    }

    if (inputSchema.properties?.textDocument?.properties) {
      inputSchema.properties.textDocument.properties = {
        ...inputSchema.properties.textDocument.properties,
        programming_language: {
          type: "string",
          description: "Optional programming language of the file, if not obvious from the file extension",
        },
      }
      logger.log(`textDocument inputSchema: ${JSON.stringify(inputSchema.properties.textDocument, null, 2)}`);
    }

    toolManager.registerTool({
      id: method.id.replace("/", "_"),
      description: method.description,
      inputSchema: inputSchema,
      handler: (args) => {

        let lsp: LspClient | undefined;
        const programmingLanguage = args.textDocument?.programming_language;
        if (programmingLanguage) {
          lsp = lsps.getLspByLanguage(programmingLanguage);
        }

        if (!lsp) {
          // try by file extension
          const extension = args.textDocument?.uri?.split(".").pop();
          if (extension) {
            lsp = lsps.getLspByExtension(extension);
          }
        }

        if (!lsp) {
          throw new Error(`No LSP found for method: ${id}`);
        }

        return lspMethodHandler(id, lsp, args)
      }
    });
  });

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

async function main(methods: string[] | undefined = undefined, lspCommand: string, verbose: boolean) {
  const logger = verbose ? consoleLogger : nullLogger;

  const toolManager = new ToolManager(logger);
  const lspMethods = await getLspMethods(methods);

  const lsp = new LspClientImpl("sh", ["-c", lspCommand], logger);
  lsps = new LspManager([{
    id: "lsp",
    extensions: [],
    languages: [],
    lsp,
  }]);

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

// Cleanup on any signal
process.on('SIGINT', dispose);
process.on('SIGTERM', dispose);
process.on('exit', dispose);

if (options.config) {
  mainConfig(options.config, options.methods, options.verbose);
} else {
  main(options.methods, options.lsp, options.verbose);
}

