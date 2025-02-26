import * as protocol from "vscode-languageserver-protocol";
import * as path from "path";
import * as fs from "fs/promises";
import { LspClient } from "./lsp";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { JSONSchema4 } from "json-schema";
import { MetaModel } from "./3rdparty/metaModel";

// List of LSP requests that we do not want to expose
const toolBlacklist = [
  // These are handled by this program
  "initialize",
  "shutdown",

  // Useless for MCP?
  "client/registerCapability",
  "client/unregisterCapability",

  // TODO: Can we handle this? typescript lsp doesn't support it
  "workspace/workspaceFolders",
];

export interface LSPMethods {
  id: string;
  description: string;
  inputSchema: JSONSchema4;
}

// Converts /path/to/file to file:///path/to/file
function pathToFileUri(path: string): string {
  return `file://${path}`
}

// convert file:///path/to/file to /path/to/file
function fileUriToPath(uri: string): string {
  if (uri.startsWith("file://")) {
    return path.resolve(uri.slice(7));
  }

  return path.resolve(uri);
}

// Let's the LSP know about a file contents
export async function openFileContents(lsp: LspClient, uri: string, contents: string): Promise<void> {
  await lsp.sendNotification(protocol.DidOpenTextDocumentNotification.method, {
    textDocument: {
      uri: uri,
      languageId: "typescript",
      version: 1,
      text: contents,
    },
  });
}

// Let's the LSP know about a file
async function openFile(lsp: LspClient, file: string, uri: string): Promise<void> {
  const contents = await fs.readFile(file, "utf8");
  await openFileContents(lsp, uri, contents);
}

export async function lspMethodHandler(lsp: LspClient, methodId: string, args: Record<string, any>): Promise<string> {
  const lspArgs = { ...args };
  // For uris, we need to tell the LSP about the file contents
  // This helper makes the LLM's work easier (and less likely to break) by not requiring the LLM to have to handle opening files itself
  // However, don't handle mem:// files as they are special in that they are not actual files on disk
  if (lspArgs.textDocument?.uri && !lspArgs.textDocument.uri.startsWith("mem://")) {
    const file = fileUriToPath(lspArgs.textDocument.uri);
    const uri = pathToFileUri(file);
    // TODO: decide how to close the file. Timeout I think is the best option?
    await openFile(lsp, file, uri);
    lspArgs.textDocument = { ...lspArgs.textDocument, uri };
  }

  return await lsp.sendRequest(methodId, lspArgs);
};

async function getMetaModel() {
  const metaModelString = await fs.readFile(
    path.join(__dirname, "resources", "metaModel.json"),
    "utf8"
  );
  return JSON.parse(metaModelString) as MetaModel;
}

async function getDereferencedJsonSchema() {
  const parser = new $RefParser()
  const schema = await parser.parse(path.join(__dirname,"./resources/generated.protocol.schema.json"))

  const dereferenced = await parser.dereference(schema, {
    mutateInputSchema: false,
  })

  if (!dereferenced.definitions) {
    throw new Error("No definitions")
  }

  return dereferenced as { definitions: Record<string, JSONSchema4> };
}

let methods: LSPMethods[] | undefined = undefined;

export async function getLspMethods(
  allowedMethodIds: string[] | undefined = undefined
): Promise<LSPMethods[]> {
  // technically this could do work twice if it's called asynchronously, but it's not a big deal
  if (methods !== undefined) {
    return methods;
  }

  const metaModel = await getMetaModel();
  const metaModelLookup = new Map(metaModel.requests.map((request) => [request.method, request]))

  const jsonSchema = await getDereferencedJsonSchema();
  const jsonSchemaLookup = new Map(
    Object.values(jsonSchema.definitions)
      .filter(definition => definition.properties?.method?.enum?.length === 1)
      .map(definition => [
        String(definition.properties?.method?.enum?.[0]),
        definition
      ])
  );

  const methodIds = allowedMethodIds ?? metaModel.requests.map((request) => request.method).filter((id) => !toolBlacklist.includes(id));

  methods = methodIds.map((id) => {
    const definition = jsonSchemaLookup.get(id)
    // TODO: Because I've sourced the jsonapi and the metamodel from different sources, they aren't always in sync.
    // In the case when I don't have a jsonschema, I'll just skip for now
    if (!definition?.properties) {
      return undefined;
    }

    // TODO: Not sure if this is the best way to handle this
    // But this occurs when the jsonschema has no param properties
    let inputSchema = definition.properties.params
    if (!inputSchema || !inputSchema.type) {
      inputSchema = {
        type: 'object' as 'object',
      }
    }

    return {
      id: id,
      description: `method: ${id}\n${metaModelLookup.get(id)?.documentation ?? ""}`,
      inputSchema: inputSchema,
    }
  }).filter((tool) => tool !== undefined);

  return methods
}
