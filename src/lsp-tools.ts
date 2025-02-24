import { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";
import * as protocol from "vscode-languageserver-protocol";
import * as path from "path";
import * as fs from "fs/promises";
import { LspClient } from "./lsp";

interface Tool extends MCPTool {
  handler: (lsp: LspClient, args: Record<string, unknown>) => Promise<any>;
}

const URI_SCHEME = "file";
function buildUri(...paths: string[]) {
  return `${URI_SCHEME}://` + path.resolve(...paths);
}

async function withFile<T>(lsp: LspClient, file: string, fn: (lsp: LspClient, uri: string) => Promise<T>): Promise<T> {
  const uri = buildUri(file)
  const contents = await fs.readFile(file, "utf8");

  await lsp.sendNotification(protocol.DidOpenTextDocumentNotification.method, {
    textDocument: {
      uri: uri,
      languageId: "typescript",
      version: 1,
      text: contents,
    },
  });

  const result = await fn(lsp, uri);
 
  // TODO: decide how to close the file. Timeout I think is the best option?
  // We could close it after every request, but chances are high that the document will continue to be inspected
  // and it'll be reopened.

  return result;
}

const documentSymbolRequest: Tool = {
  name: protocol.DocumentSymbolRequest.method,
  description: "Get the symbols in a file",
  inputSchema: {
    type: "object",
    properties: {
      file: { type: "string" },
    },
  },
  handler: async (lsp: LspClient, args: Record<string, unknown>) => {
    const file = args['file'] as string
    if (!file) {
      throw new Error("No file")
    }

    return withFile(lsp, file, (lsp, uri) =>
      lsp.sendRequest(protocol.DocumentSymbolRequest.method, {
        textDocument: { uri: uri },
      }),
    );
  },
};

const definitionRequest: Tool = {
  name: protocol.DefinitionRequest.method,
  description: "Get the definition of a symbol",
  inputSchema: {
    type: "object",
    properties: {
      file: { type: "string" },
      line: { type: "number" },
      character: { type: "number" },
    },
  },
  handler: async (lsp: LspClient, args: Record<string, unknown>) => {
    const file = args['file'] as string
    const line = args['line'] as number
    const character = args['character'] as number
    if (!file) {
      throw new Error("No file")
    }

    return withFile(lsp, file, (lsp, uri) =>
      lsp.sendRequest(protocol.DefinitionRequest.method, {
        textDocument: { uri: uri },
        position: { line: line, character: character },
      }),
    );
  },
};

export function getTools(): Tool[] {
  return [documentSymbolRequest, definitionRequest];
}