
import { LspClient, LspClientImpl } from "./lsp";
import { createMcp, startMcp } from "./mcp";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getLspMethods, lspMethodHandler, LSPMethods, openFileContents } from "./lsp-methods";
import { ToolManager } from "./tool-manager";
import { Logger } from "vscode-jsonrpc";
import { Config } from "./config";
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { JSONSchema4, JSONSchema4TypeName } from "json-schema";
import { LspManager } from "./lsp-manager";

export class App {
  private readonly toolManager: ToolManager;
  private readonly lspManager: LspManager;
  private readonly mcp: McpServer;
  private readonly lspMethods: Promise<LSPMethods[]>;

  constructor(
    config: Config,
    logger: Logger,
  ) {
    // keeps track of all the tools we're sending to the MCP
    this.toolManager = new ToolManager(logger);
    // keeps track of all the LSP Clients we're using
    this.lspManager = new LspManager(this.buildLsps(config.lsps, logger));
    // the MCP server
    this.mcp = createMcp();
    // The LSP methods we support (textDocument/foo, etc)
    this.lspMethods = getLspMethods(config.methods);

    // Cleanup on any signal
    process.on('SIGINT', () => this.dispose());
    process.on('SIGTERM', () => this.dispose());
    process.on('exit', () => this.dispose());
  }

  private async initializeMcp() {
    this.mcp.setRequestHandler(ListToolsRequestSchema, async () => {
      const mcpTools = this.toolManager.getTools().map((tool) => ({
        name: tool.id,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return {
        tools: mcpTools
      };
    });

    this.mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      if (!args) {
        throw new Error("No arguments");
      }

      const result = await this.toolManager.callTool(name, args);
      const serialized = typeof result === "string" ? result : JSON.stringify(result, null, 2);

      return {
        content: [{ type: "text", text: serialized }],
      };
    });
  }

  private async registerTools() {
    this.toolManager.registerTool({
      id: "lsp_info",
      description: "Returns information about the the LSP tools available. This is useful for debugging which programming languages are supported.",
      inputSchema: {
        type: "object" as "object",
      },
      handler: async () => {
        const result = this.lspManager.getLsps().map((lsp) => {
          return {
            id: lsp.id,
            languages: lsp.languages,
            extensions: lsp.extensions,
          }
        });

        return JSON.stringify(result, null, 2)
      },
    });

    this.toolManager.registerTool({
      id: "file_contents_to_uri",
      description:
        `Creates a URI given some file contents to be used in the LSP methods that require a URI. This is only required if the file is not on the filesystem. Otherwise you may pass the file path directly.`,
      inputSchema: {
        type: "object" as "object",
        properties: {
          file_contents: {
            type: "string",
            description: "The contents of the file",
            required: true,
          },
          programming_language: {
            type: "string",
            description: "The programming language of the file",
            required: false,
          },
        },
      },
      handler: async (args) => {
        const { file_contents, programming_language } = args;
        const lsp = this.lspManager.getLspByLanguage(programming_language) || this.lspManager.getDefaultLsp();
        const uri = `mem://${Math.random().toString(36).substring(2, 15)}.${lsp.id}`;
        if (!lsp) {
          throw new Error(`No LSP found for language: ${programming_language}`);
        }

        await openFileContents(lsp, uri, file_contents);

        return uri;
      },
    });

    (await this.lspMethods).forEach((method) => {
      const id = method.id;
      const inputSchema: JSONSchema4 = this.removeInputSchemaInvariants(method.inputSchema);

      if (this.lspManager.hasManyLsps() && inputSchema.properties?.textDocument?.properties) {
        inputSchema.properties.textDocument.properties = {
          ...inputSchema.properties.textDocument.properties,
          programming_language: {
            type: "string",
            description: "Optional programming language of the file, if not obvious from the file extension",
            required: false,
          },
        };
      }

      this.toolManager.registerTool({
        id: method.id.replace("/", "_"),
        description: method.description,
        inputSchema: inputSchema,
        handler: (args) => {
          let lsp: LspClient | undefined;
          if (this.lspManager.hasManyLsps() && args.textDocument) {
            const programmingLanguage = args.textDocument.programming_language;
            if (programmingLanguage) {
              lsp = this.lspManager.getLspByLanguage(programmingLanguage);
            }

            if (!lsp) {
              // try by file extension
              const extension = args.textDocument.uri?.split(".").pop();
              if (extension) {
                lsp = this.lspManager.getLspByExtension(extension);
              }
            }
          }

          if (!lsp) {
            lsp = this.lspManager.getDefaultLsp();
          }

          return lspMethodHandler(lsp, id, args);
        },
      });
    });
  }

  public async start() {
    await this.registerTools(),
    await this.initializeMcp(),

    await startMcp(this.mcp);
  }

  public async dispose() {
    if (this.lspManager !== undefined) {
      this.lspManager.getLsps().forEach((lsp) => lsp.dispose());
    }

    if (this.mcp !== undefined) {
      await this.mcp.close();
    }
  }

  // Remove invariant types from the input schema since some MCPs have a hard time with them
  // Looking at you mcp-client-cli
  private removeInputSchemaInvariants(inputSchema: JSONSchema4): JSONSchema4 {
    let type = inputSchema.type;
    if (type && Array.isArray(type)) {
      if (type.length === 1) {
        type = type[0] as JSONSchema4TypeName;
      } else if (type.includes('string')) {
        type = 'string' as JSONSchema4TypeName;
      } else {
        // guess
        type = type[0] as JSONSchema4TypeName;
      }
    }
    return {
      ...inputSchema,
      type: type,
      properties: inputSchema.properties
        ? Object.fromEntries(
            Object.entries(inputSchema.properties).map(([key, value]) => [
              key,
              this.removeInputSchemaInvariants(value),
            ]),
          )
        : undefined,
    };
  }

  private buildLsps(lspConfigs: Config["lsps"], logger: Logger): LspClient[] {
    return lspConfigs.map(
      (lspConfig) =>
        new LspClientImpl(
          lspConfig.id,
          lspConfig.languages,
          lspConfig.extensions,
          lspConfig.command,
          lspConfig.args,
          logger,
        ),
    );
  }
}
