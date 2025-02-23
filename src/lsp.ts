import { ChildProcess, spawn } from "child_process";
import * as fs from "fs/promises";
import * as rpc from "vscode-jsonrpc";
import { StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node";
import { InitializeRequest, InitializeResult } from "vscode-languageserver-protocol";
import * as protocol from "vscode-languageserver-protocol";
import { consoleLogger } from "./logger";
import path from "path";

const URI_SCHEME = "lsp";
const logger = consoleLogger;

export interface LspClient {
  dispose: () => void;
  sendRequest(method: string, args: any): Promise<any>;
  sendNotification(method: string, args: any): Promise<void>;
}

function buildUri(...paths: string[]) {
  return `${URI_SCHEME}://` + path.resolve(...paths);
}

export async function startLsp(
  command: string,
  args: string[],
): Promise<LspClient> {
  return LspClientImpl.create(command, args);
}

class LspClientImpl implements LspClient {
  public static async create(
    command: string,
    args: string[],
  ): Promise<LspClient> {
    const childProcess = spawn(command, args);
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

    const response = await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      rootUri: buildUri('/'),
      capabilities: {},
    });

    return new LspClientImpl(childProcess, connection, response.capabilities);
  }

  private constructor(
    private readonly childProcess: ChildProcess,
    private readonly connection: rpc.MessageConnection,
    private readonly capabilities: protocol.ServerCapabilities, // TODO: not sure what I'm doing with this, but it'll be needed I feel like
  ) {}

  sendRequest(method: string, args: any): Promise<any> {
    return this.connection.sendRequest(method, args);
  }

  sendNotification(method: string, args: any): Promise<void> {
    return this.connection.sendNotification(method, args);
  }

  dispose() {
    this.connection.dispose();
    this.childProcess.kill();
  }
}

export async function initialize(lsp: LspClient) {
  try {
    const file = path.resolve(__dirname, "lsp.ts");
    const contents = await fs.readFile(file, "utf8");
    const uri = buildUri(file);

    // Before requesting symbols, you need to notify the server about the document
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
    logger.info(`Notification: ${JSON.stringify(notification)}`);

    const symbols = await lsp.sendRequest(
      protocol.DocumentSymbolRequest.method,
      {
        textDocument: {
          uri: uri,
        },
      },
    );
    logger.info(`Symbols: ${JSON.stringify(symbols)}`);
  } catch (error) {
    logger.error(`Error initializing server: ${error}`);
  }
}
