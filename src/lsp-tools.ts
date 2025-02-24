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
  
async function openFile(lsp: LspClient, file: string): Promise<string> {
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
  
  return uri
}

async function withFile<T>(lsp: LspClient, file: string, fn: (lsp: LspClient, uri: string) => Promise<T>): Promise<T> {
  const uri = await openFile(lsp, file)

  const result = await fn(lsp, uri);
 
  // TODO: decide how to close the file. Timeout I think is the best option?
  // We could close it after every request, but chances are high that the document will continue to be inspected
  // and it'll be reopened.

  return result;
}

const documentSymbolRequest: Tool = {
  name: protocol.DocumentSymbolRequest.method.replace("/", "_"),
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

const TextDocumentPositionParams = {
  additionalProperties: false,
  description:
    "A parameter literal used in requests to pass a text document and a position inside that document.",
  properties: {
    position: {
      additionalProperties: false,
      description:
        "Position in a text document expressed as zero-based line and character offset.\nThe offsets are based on a UTF-16 string representation. So a string of the form\n`a𐐀b` the character offset of the character `a` is 0, the character offset of `𐐀`\nis 1 and the character offset of `b` is 3 since `𐐀` is represented using two code\nunits in UTF-16.\n\nPositions are line end character agnostic. So you cannot specify a position that\ndenotes `\\r|\\n` or `\\n|` where `|` represents the character offset.",
      properties: {
        character: {
          description:
            "Character offset on a line in a document (zero-based). Assuming that the line is\nrepresented as a string, the `character` value represents the gap between the\n`character` and `character + 1`.\n\nIf the character value is greater than the line length it defaults back to the\nline length.\nIf a line number is negative, it defaults to 0.",
          type: "number",
        },
        line: {
          description:
            "Line position in a document (zero-based).\nIf a line number is greater than the number of lines in a document, it defaults back to the number of lines in the document.\nIf a line number is negative, it defaults to 0.",
          type: "number",
        },
      },
      required: ["line", "character"],
      type: "object",
    },
    textDocument: {
      additionalProperties: false,
      description:
        "A literal to identify a text document in the client. \nThe TextDocumentIdentifier namespace provides helper functions to work with\nTextDocumentIdentifier literals.",
      properties: {
        uri: {
          description: "A tagging type for string properties that are actually URIs.",
          type: "string",
        },
      },
      required: ["uri"],
      type: "object",
    },
  },
  required: ["textDocument", "position"],
  type: "object" as "object",
};


const definitionRequest: Tool = {
  name: protocol.DefinitionRequest.method.replace("/", "_"),
  description: "Get the definition of a symbol",
  inputSchema: TextDocumentPositionParams,
  handler: async (lsp: LspClient, args: Record<string, any>) => {
    const lspArgs = { ...args }
    if (lspArgs.textDocument?.uri) {
      const file = lspArgs.textDocument.uri
      const uri = await openFile(lsp, file)
      lspArgs.textDocument = { ...lspArgs.textDocument, uri }
    }
    
    return await lsp.sendRequest(protocol.DefinitionRequest.method, lspArgs);
  },
};

export function getTools(): Tool[] {
  return [documentSymbolRequest, definitionRequest];
}