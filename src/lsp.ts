import { ChildProcess, spawn } from "child_process";
import * as rpc from "vscode-jsonrpc";
import { StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node";
import { InitializeRequest } from "vscode-languageserver-protocol";
import * as protocol from "vscode-languageserver-protocol";
import { consoleLogger } from "./logger";
import { Logger } from "vscode-jsonrpc";
import path from "path";

const URI_SCHEME = "lsp";

export interface LspClient {
  readonly connection: rpc.MessageConnection;
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
  logger: Logger = consoleLogger,
): Promise<LspClient> {
  return LspClientImpl.create(command, args, logger);
}

class LspClientImpl implements LspClient {
  public static async create(
    command: string,
    args: string[],
    logger: Logger,
  ): Promise<LspClient> {
    const childProcess = spawn(command, args);
    const connection = rpc.createMessageConnection(
      new StreamMessageReader(childProcess.stdout),
      new StreamMessageWriter(childProcess.stdin),
      logger,
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
    readonly connection: rpc.MessageConnection, // TODO: make this private
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