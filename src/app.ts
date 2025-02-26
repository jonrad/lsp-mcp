
import { LspClient, LspClientImpl } from "./lsp";
import { startMcp } from "./mcp";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { lspMethodHandler, LSPMethods, openFileContents } from "./lsp-methods";
import { ToolManager } from "./tool-manager";
import { Logger } from "vscode-jsonrpc";
import { Config } from "./config";
import { Server as McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { JSONSchema4, JSONSchema4TypeName } from "json-schema";
import { LspManager } from "./lsp-manager";

export interface LspMeta {
  id: string;
  extensions: string[];
  languages: string[];
  lsp: LspClient;
}

export class App {
  private readonly toolManager: ToolManager;

  constructor(
    public readonly lsps: LspManager,
    public readonly lspMethods: LSPMethods[],
    public readonly mcp: McpServer,
    public readonly logger: Logger,
  ) {
    this.toolManager = new ToolManager(logger);

    // Cleanup on any signal
    process.on('SIGINT', () => this.dispose());
    process.on('SIGTERM', () => this.dispose());
    process.on('exit', () => this.dispose());
  }

  private async registerMcp() {
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

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    });
  }

  private async registerTools() {
    this.toolManager.registerTool({
      id: "file_contents_to_uri",
      description:
        "Creates a URI given some file contents to be used in the LSP methods that require a URI",
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
        const lsp = this.lsps.getLspByLanguage(programming_language);
        if (!lsp) {
          throw new Error(`No LSP found for language: ${programming_language}`);
        }

        await openFileContents(lsp, uri, file_contents);

        return uri;
      },
    });

    this.lspMethods.forEach((method) => {
      const id = method.id;
      const inputSchema: JSONSchema4 = this.removeInputSchemaInvariants(method.inputSchema);

      if (inputSchema.properties?.textDocument?.properties) {
        inputSchema.properties.textDocument.properties = {
          ...inputSchema.properties.textDocument.properties,
          programming_language: {
            type: "string",
            description:
              "Optional programming language of the file, if not obvious from the file extension",
          },
        };
        this.logger.log(
          `textDocument inputSchema: ${JSON.stringify(inputSchema.properties.textDocument, null, 2)}`,
        );
      }

      this.toolManager.registerTool({
        id: method.id.replace("/", "_"),
        description: method.description,
        inputSchema: inputSchema,
        handler: (args) => {
          let lsp: LspClient | undefined;
          const programmingLanguage = args.textDocument?.programming_language;
          if (programmingLanguage) {
            lsp = this.lsps.getLspByLanguage(programmingLanguage);
          }

          if (!lsp) {
            // try by file extension
            const extension = args.textDocument?.uri?.split(".").pop();
            if (extension) {
              lsp = this.lsps.getLspByExtension(extension);
            }
          }

          if (!lsp) {
            throw new Error(
              `No LSP found for method: ${id} with uri: ${args.textDocument?.uri}`,
            );
          }

          return lspMethodHandler(id, lsp, args);
        },
      });
    });
  }

  public async start() {
    await this.registerTools(),
    await this.registerMcp(),

    // TODO!!! REMOVE
    await Promise.all(this.lsps.getLsps().map((lsp) => lsp.start()));
    await startMcp(this.mcp);
  }

  public async dispose() {
    if (this.lsps !== undefined) {
      this.lsps.getLsps().forEach((lsp) => lsp.dispose());
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

  private buildLsps(lspConfigs: Config["lsps"], logger: Logger): LspMeta[] {
    return lspConfigs.map((lspConfig) => ({
      id: lspConfig.id,
      extensions: lspConfig.extensions,
      languages: lspConfig.languages,
      lsp: new LspClientImpl(lspConfig.command, lspConfig.args, logger)
    }));
  }
}
