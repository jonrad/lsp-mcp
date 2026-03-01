import { LspClient, LspClientImpl } from "./lsp";
import { createMcp, startMcp } from "./mcp";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  getLspMethods,
  lspMethodHandler,
  LSPMethods,
  openFileContents,
} from "./lsp-methods";
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
  private readonly availableMethodIds: Promise<LSPMethods[]>;
  private readonly workspace: string;

  constructor(
    config: Config,
    protected readonly logger: Logger,
  ) {
    // keeps track of all the tools we're sending to the MCP
    this.toolManager = new ToolManager(logger);
    // keeps track of all the LSP Clients we're using
    this.lspManager = new LspManager(this.buildLsps(config.lsps, logger));
    // the MCP server
    this.mcp = createMcp();
    // The LSP methods we support (textDocument/foo, etc)
    this.availableMethodIds = getLspMethods(config.methods);

    this.workspace = config.workspace ?? "/";

    // Cleanup on any signal
    process.on("SIGINT", () => this.dispose());
    process.on("SIGTERM", () => this.dispose());
    process.on("exit", () => this.dispose());
  }

  private async initializeMcp() {
    this.mcp.setRequestHandler(ListToolsRequestSchema, async () => {
      const mcpTools = this.toolManager.getTools().map((tool) => ({
        name: tool.id,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return {
        tools: mcpTools,
      };
    });

    this.mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      if (!args) {
        throw new Error("No arguments");
      }

      const result = await this.toolManager.callTool(name, args);
      const serialized = this.formatResult(result);

      return {
        content: [{ type: "text", text: serialized }],
      };
    });
  }

  private formatResult(result: any): string {
    if (result === null || result === undefined) {
      return "null";
    }

    if (typeof result === "string") {
      return this.cleanText(result);
    }

    // Handle standard LSP Hover structure
    if (result.contents) {
      if (typeof result.contents === "string") {
        return this.cleanText(result.contents);
      }
      if (result.contents.value) {
        return this.cleanText(result.contents.value);
      }
      if (Array.isArray(result.contents)) {
        return result.contents
          .map((c: any) => this.formatResult(c))
          .join("\n\n");
      }
    }

    // Handle nested structures or other objects by trying to find 'value' or 'name' fields
    if (typeof result === "object" && !Array.isArray(result)) {
      // If it's a simple wrapper like { result: ... }, recurse
      const keys = Object.keys(result);
      if (
        keys.length === 1 &&
        (keys[0] === "result" || keys[0] === "contents")
      ) {
        return this.formatResult(result[keys[0]]);
      }

      // Otherwise, return as pretty-printed JSON but cleaned
      return this.cleanText(JSON.stringify(result, null, 2));
    }

    if (Array.isArray(result)) {
      return result.map((item) => this.formatResult(item)).join("\n---\n");
    }

    return this.cleanText(JSON.stringify(result, null, 2));
  }

  private cleanText(text: string): string {
    if (!text) return "";
    return (
      text
        .replace(/&#039;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\\n/g, "\n")
        // Remove multiple consecutive newlines
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    );
  }

  private async registerTools() {
    this.toolManager.registerTool({
      id: "lsp_info",
      description:
        "Returns information about the the LSP tools available. This is useful for debugging which programming languages are supported.",
      inputSchema: {
        type: "object" as const,
      },
      handler: async () => {
        const result = this.lspManager.getLsps().map((lsp) => {
          const started = lsp.isStarted();
          return {
            id: lsp.id,
            languages: lsp.languages,
            extensions: lsp.extensions,
            // Remember, this is communicating with an AI. It doesn't care about type safety
            started: started
              ? true
              : `Not started. LSP will start automatically when needed, such as when analyzing a file with extensions ${lsp.extensions.join(", ")}.`,
            capabilities: started
              ? lsp.capabilities
              : "LSP not started. Capabilities will be available when started.",
          };
        });

        return JSON.stringify(result, null, 2);
      },
    });

    this.toolManager.registerTool({
      id: "file_contents_to_uri",
      description: `Creates a URI given some file contents to be used in the LSP methods that require a URI. This is only required if the file is not on the filesystem. Otherwise you may pass the file path directly.`,
      inputSchema: {
        type: "object" as const,
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
        required: ["file_contents"],
      },
      handler: async (args) => {
        const { file_contents, programming_language } = args;
        const lsp =
          this.lspManager.getLspByLanguage(programming_language) ||
          this.lspManager.getDefaultLsp();
        const uri = `mem://${Math.random().toString(36).substring(2, 15)}.${lsp.id}`;
        if (!lsp) {
          throw new Error(`No LSP found for language: ${programming_language}`);
        }

        await openFileContents(lsp, uri, file_contents);

        return uri;
      },
    });

    this.toolManager.registerTool({
      id: "get_diagnostics",
      description:
        "Returns the latest diagnostics (errors, warnings, linting) for a specific file URI.",
      inputSchema: {
        type: "object" as const,
        properties: {
          uri: {
            type: "string",
            description: "The URI of the file to get diagnostics for",
          },
        },
        required: ["uri"],
      },
      handler: async (args) => {
        const { uri } = args;
        // Try to find the LSP that handles this file
        const extension = uri.split(".").pop();
        const lsp = extension
          ? this.lspManager.getLspByExtension(extension)
          : this.lspManager.getDefaultLsp();

        if (!lsp) {
          throw new Error(`No LSP found for file: ${uri}`);
        }

        const diagnostics = lsp.getDiagnostics(uri);
        if (diagnostics.length === 0) {
          return "No issues found.";
        }
        return this.formatResult(diagnostics);
      },
    });

    const availableMethodIds = (await this.availableMethodIds).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    const lsps = this.lspManager.getLsps();
    const lspProperty: JSONSchema4 | undefined =
      lsps.length > 1
        ? {
            type: "string",
            name: "lsp",
            description:
              "The LSP to use to execute this method. Options are: " +
              lsps
                .map(
                  (lsp) =>
                    `  ${lsp.id} for the programming languages ${lsp.languages.join(", ")}`,
                )
                .join("\n"),
            enum: lsps.map((lsp) => lsp.id),
          }
        : undefined;

    availableMethodIds.forEach((method) => {
      const id = method.id;

      // Clean up the input schema a bit
      const inputSchema: JSONSchema4 = this.removeInputSchemaInvariants(
        method.inputSchema,
      );
      if (inputSchema.properties) {
        for (const [propertyKey, _property] of Object.entries(
          inputSchema.properties,
        )) {
          if (["partialResultToken", "workDoneToken"].includes(propertyKey)) {
            if (
              !inputSchema.required ||
              !Array.isArray(inputSchema.required) ||
              !inputSchema.required.includes(propertyKey)
            ) {
              delete inputSchema.properties[propertyKey];
            }
          }
        }
      }

      // If we're set up with more than one LSP, we'll request the LSP to be optionally specified
      // If it isn't specified, we'll have to use some logic to figure out which LSP to use
      if (lspProperty && inputSchema.properties) {
        inputSchema.properties[lspProperty.name] = lspProperty;
      }

      this.toolManager.registerTool({
        id: method.id.replace("/", "_"),
        description: method.description,
        inputSchema: inputSchema,
        handler: async (args) => {
          let lsp: LspClient | undefined;
          if (lspProperty) {
            const lspId = args[lspProperty.name];
            if (lspId) {
              lsp = this.lspManager.getLsp(lspId);
              if (!lsp) {
                // Sometimes the LLM gets confused and specifies the language instead of the LSP ID
                lsp = this.lspManager.getLspByLanguage(lspId);
              }
            }

            if (!lsp && args.textDocument?.uri) {
              // try by file extension
              const extension = args.textDocument.uri.split(".").pop();
              if (extension) {
                lsp = this.lspManager.getLspByExtension(extension);
              }
            }
          }

          // I wonder if using the last used LSP would be a better default...
          if (!lsp) {
            lsp = this.lspManager.getDefaultLsp();
          }

          let result = await lspMethodHandler(lsp, id, args);

          // Retry logic if it returns null (common during initial analysis or race conditions)
          if (result === null || result === undefined) {
            for (let i = 0; i < 5; i++) {
              console.error(
                `${id} returned null, retrying in 400ms (attempt ${i + 1}/5)...`,
              );
              await new Promise((resolve) => setTimeout(resolve, 400));
              result = await lspMethodHandler(lsp, id, args);
              if (result !== null && result !== undefined) {
                break;
              }
            }
          }

          return result;
        },
      });
    });
  }

  public async start() {
    await this.registerTools();
    await this.initializeMcp();
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

  private async getAvailableMethodIds() {
    return this.availableMethodIds;
  }

  // Remove invariant types from the input schema since some MCPs have a hard time with them
  // Looking at you mcp-client-cli
  private removeInputSchemaInvariants(inputSchema: JSONSchema4): JSONSchema4 {
    let type = inputSchema.type;
    if (type && Array.isArray(type)) {
      if (type.length === 1) {
        type = type[0] as JSONSchema4TypeName;
      } else if (type.includes("string")) {
        type = "string" as JSONSchema4TypeName;
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
          this.workspace,
          lspConfig.command,
          lspConfig.args,
          logger,
          lspConfig.settings,
        ),
    );
  }
}
