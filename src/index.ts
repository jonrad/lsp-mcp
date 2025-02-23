import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "child_process";
import * as rpc from "vscode-jsonrpc";
import { StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node";
import { InitializeRequest, RequestType } from "vscode-languageserver-protocol";

// Create an MCP server
const server = new McpServer({
  name: "Demo",
  version: "1.0.0",
});

// Add an addition tool
server.tool("add", { a: z.number(), b: z.number() }, async ({ a, b }) => ({
  content: [{ type: "text", text: String(a + b) }],
}));

// Add a dynamic greeting resource
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [
      {
        uri: uri.href,
        text: `Hello, ${name}!`,
      },
    ],
  }),
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();

async function main() {
  await server.connect(transport);
}

/*
 * Start lsp testing
 */

console.log("Starting language server");
// Start the language server as a child process
const childProcess = spawn("sh", ["-c", "yarn --silent typescript-language-server --stdio --log-level 4 | tee lsp.log"], {
  stdio: ["pipe", "pipe", "pipe"],
});

console.log("Child process started");

const logger = {
    error: (message: string) => {
        console.error(message);
    },
    warn: (message: string) => {
        console.warn(message);
    },
    info: (message: string) => {
        console.info(message);
    },
    log: (message: string) => {
        console.log(message);
    }
}

// Create an RPC connection
const connection = rpc.createMessageConnection(
  new StreamMessageReader(childProcess.stdout),
  new StreamMessageWriter(childProcess.stdin),
  logger
);

connection.onError((error) => {
  console.error("Connection error:", error);
});

connection.onClose(() => {
  console.log("Connection closed");
});

connection.onUnhandledNotification((notification) => {
  console.log("Unhandled notification:", notification);
});

console.log("Connection created");

connection.listen();

console.log("Connection listening");

// Step 1: Send Initialize Request
async function initialize() {
  console.log("Sending Initialize Request");
  try {
    const response = await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      rootUri: null,
      capabilities: {},
    });

    console.log("Server initialized:", response);
  } catch (error) {
    console.error("Error initializing server:", error);
  }
}

initialize();
