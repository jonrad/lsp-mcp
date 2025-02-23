import { spawn } from "child_process";
import * as fs from "fs/promises";
import * as rpc from "vscode-jsonrpc";
import { StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node";
import { InitializeRequest } from "vscode-languageserver-protocol";
import * as protocol from "vscode-languageserver-protocol";
import { consoleLogger } from "./logger";
import path from "path";

const logger = consoleLogger;

export interface Lsp {
  connection: rpc.MessageConnection;
  stop: () => void;
}

export async function startLsp(command: string, args: string[]): Promise<Lsp> {
  // Start the language server as a child process
  const childProcess = spawn(command, args);
  // Create an RPC connection
  const connection = rpc.createMessageConnection(
    new StreamMessageReader(childProcess.stdout),
    new StreamMessageWriter(childProcess.stdin),
    consoleLogger,
  );
  connection.onError((error) => {
    logger.error(`Connection error: ${error}`);
    childProcess.kill();
  });

  connection.onClose(() => {
    logger.log("Connection closed");
    childProcess.kill();
  });

  connection.onUnhandledNotification((notification) => {
    logger.log(`Unhandled notification: ${JSON.stringify(notification)}`);
  });

  connection.listen();

  return { connection, stop: () => childProcess.kill() };
}

export async function initialize(lsp: Lsp) {
  try {
    const response = await lsp.connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      rootUri: "file://" + path.resolve(__dirname),
      capabilities: {},
    });

    logger.info(`Server initialized: ${JSON.stringify(response)}`);
    const file = path.resolve(__dirname, "lsp.ts");
    const contents = await fs.readFile(file, "utf8");

    // Before requesting symbols, you need to notify the server about the document
    const notification = await lsp.connection.sendNotification(protocol.DidOpenTextDocumentNotification.type, {
      textDocument: {
        uri: "file://" + file,
        languageId: "typescript",
        version: 1,
        text: contents
      }
    });
    logger.info(`Notification: ${JSON.stringify(notification)}`);

    const symbols = await lsp.connection.sendRequest(
      protocol.DocumentSymbolRequest.type,
      {
        textDocument: {
          uri: "file://" + file,
        },
      },
    );
    logger.info(`Symbols: ${JSON.stringify(symbols)}`);
  } catch (error) {
    logger.error(`Error initializing server: ${error}`);
  }
}
