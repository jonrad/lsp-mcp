import { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";
import * as protocol from "vscode-languageserver-protocol";
import * as path from "path";
import * as fs from "fs/promises";
import { LspClient } from "./lsp";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { JSONSchema4 } from "json-schema";
import { MetaModel } from "./metaModel";
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

let tools: Tool[] | undefined = undefined;

export async function getTools(): Promise<Tool[]> {
  // technically this could do work twice if it's called asynchronously, but it's not a big deal
  if (tools !== undefined) {
    return tools;
  }

  const metaModelString = await fs.readFile("dev/metaModel.json", "utf8");
  const metaModel = JSON.parse(metaModelString) as MetaModel;
  const metaModelLookup = new Map(metaModel.requests.map((request) => [request.method, request]))

  const parser = new $RefParser()
  const schema = await parser.parse("./dev/generated.protocol.schema.json")

  const dereferenced = await parser.dereference(schema, {
    mutateInputSchema: false,
  })

  if (!dereferenced.definitions) {
    throw new Error("No definitions")
  }
  
  const dereferencedLookup: Record<string, JSONSchema4> = Object.values(dereferenced.definitions).reduce((acc: Record<string, JSONSchema4>, definition) => {
    if (definition.properties?.method?.enum?.length !== 1) {
      return acc
    }
    acc[definition.properties.method.enum[0]] = definition
    return acc
  });
  
  const toolIds = metaModel.requests.map((request) => request.method)
  
  tools = toolIds.map((id) => {
    const definition = dereferencedLookup[id]
    // TODO: Because I've sourced the jsonapi and the metamodel from different sources, they aren't always in sync.
    // In the case when I don't have a jsonschema, I'll just skip for now
    if (!definition?.properties) {
      return undefined;
    }

    // TODO: Not sure if this is the best way to handle this
    // But this occurs when the jsonschema has no param properties
    let inputSchema = definition.properties.params as any
    if (!inputSchema || !inputSchema.type) {
      inputSchema = {
        type: 'object' as 'object',
      }
    }

    return {
      name: id.replace("/", "_"), // slash is not valid in tool names
      description: `method: ${id}\n${metaModelLookup.get(id)?.documentation ?? ""}`,
      inputSchema: inputSchema,
      handler: async (lsp: LspClient, args: Record<string, any>) => {
        const lspArgs = { ...args }
        if (lspArgs.textDocument?.uri) {
          const file = lspArgs.textDocument.uri
          // TODO: decide how to close the file. Timeout I think is the best option?
          const uri = await openFile(lsp, file)
          lspArgs.textDocument = { ...lspArgs.textDocument, uri }
        }
        
        return await lsp.sendRequest(id, lspArgs);
      },
    }
  }).filter((tool) => tool !== undefined);
  
  return tools
}