import { startLsp, initialize } from "./lsp";
import { startMcp, createMcp } from "./mcp";
import * as fs from "fs/promises";
import { z } from "zod";
import * as protocol from "vscode-languageserver-protocol";
import path from "path";

const URI_SCHEME = "lsp";
function buildUri(...paths: string[]) {
  return `${URI_SCHEME}://` + path.resolve(...paths);
}


async function main() {
  const lsp = await startLsp("sh", [
    "-c",
    "yarn --silent typescript-language-server --stdio --log-level 4 | tee lsp.log",
  ]);

  const mcp = createMcp();
  // Add an addition tool
  mcp.tool(
    protocol.DocumentSymbolRequest.method, // name
    "Get the symbols in a file", // description
    { file: z.string() }, // args
    async ({ file }) => {
      try {

        const contents = await fs.readFile(file, "utf8");
        const uri = buildUri(file);
        const notification = await lsp.sendNotification(
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
        const result = await lsp.sendRequest(
          protocol.DocumentSymbolRequest.method,
          { textDocument: { uri: uri } },
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        console.error(`Error getting symbols: ${error}`);
        throw error;
      }
    },
  );

  await startMcp(mcp);
  console.log("Started MCP");

  // await initialize(lsp);
  // console.log("Initialized");
  // lsp.dispose();
  //
  // lsp.dispose();
}

main();