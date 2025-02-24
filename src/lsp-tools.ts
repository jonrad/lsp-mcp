import { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";
import * as protocol from "vscode-languageserver-protocol";
import * as path from "path";
import * as fs from "fs/promises";
import { LspClient } from "./lsp";
const URI_SCHEME = "file";
function buildUri(...paths: string[]) {
  return `${URI_SCHEME}://` + path.resolve(...paths);
}

interface Tool extends MCPTool {
  handler: (lsp: LspClient, args: Record<string, unknown>) => Promise<any>;
}

/*
CallToolRequest {
  method: 'tools/call',
  params: { name: 'textDocument/documentSymbol', arguments: { file: 'foo' } }
}
*/

const documentSymbolRequest: Tool = {
  name: protocol.DocumentSymbolRequest.method,
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

    const uri = buildUri(file)
    const contents = await fs.readFile(file, "utf8");
    await lsp.sendNotification(
      protocol.DidOpenTextDocumentNotification.method,
      {
        textDocument: {
          uri: uri,
          languageId: "typescript",
          version: 1,
          text: contents,
        },
      },
    );
    return await lsp.sendRequest(
      protocol.DocumentSymbolRequest.method,
      { textDocument: { uri: uri } },
    );
  },
};

export function getTools(): Tool[] {
  return [documentSymbolRequest];
}