import { ChildProcess, spawn } from "child_process";
import * as rpc from "vscode-jsonrpc";
import { StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node";
import { InitializeRequest } from "vscode-languageserver-protocol";
import * as protocol from "vscode-languageserver-protocol";
import { Logger } from "vscode-jsonrpc";
import path from "path";

export interface LspClient {
  id: string;
  languages: string[];
  extensions: string[];
  start(): Promise<void>;
  dispose: () => void;
  sendRequest(method: string, args: any): Promise<any>;
  sendNotification(method: string, args: any): Promise<void>;
}

export class LspClientImpl implements LspClient {

  protected childProcess: ChildProcess | undefined;

  protected connection: rpc.MessageConnection | undefined;

  protected capabilities: protocol.ServerCapabilities | undefined;

  public constructor(
    public readonly id: string,
    public readonly languages: string[],
    public readonly extensions: string[],
    private readonly command: string,
    private readonly args: string[],
    private readonly logger: Logger, // TODO: better long term solution for logging
  ) {}

  public async start() {
    if (this.isStarted()) {
      return;
    }

    const childProcess = this.childProcess = spawn(this.command, this.args);

    if (!childProcess.stdout || !childProcess.stdin) {
      throw new Error("Child process not started");
    }

    const connection = this.connection = rpc.createMessageConnection(
      new StreamMessageReader(childProcess.stdout),
      new StreamMessageWriter(childProcess.stdin),
      this.logger,
    );

    connection.onError((error) => {
      this.logger.error(`Connection error: ${error}`);
      childProcess.kill();
    });

    connection.onClose(() => {
      this.logger.log("Connection closed");
      childProcess.kill();
    });

    connection.onUnhandledNotification((notification) => {
      this.logger.log(`Unhandled notification: ${JSON.stringify(notification)}`);
    });

    connection.listen();

    // TODO: We should figure out how to specify the capabilities we want
    const capabilities: protocol.ClientCapabilities = {};

    const response = await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      rootUri: "file:///", // TODO: figure out the best way to handle this
      capabilities: capabilities,
    });

    this.logger.info(`Server LSP capabilities: ${JSON.stringify(response.capabilities, null, 2)}`);
  }

  private isStarted(): this is LspClientImpl & { connection: rpc.MessageConnection } {
    return !!this.connection;
  }

  private assertStarted(): asserts this is LspClientImpl & { connection: rpc.MessageConnection } {
    if (!this.connection) {
      throw new Error("Not started");
    }
  }

  async sendRequest(method: string, args: any): Promise<any> {
    if (!this.isStarted()) {
      await this.start();
    }

    this.assertStarted();

    return await this.connection.sendRequest(method, args);
  }

  async sendNotification(method: string, args: any): Promise<void> {
    if (!this.isStarted()) {
      await this.start();
    }

    this.assertStarted();

    return await this.connection.sendNotification(method, args);
  }

  dispose() {
    try {
      this.connection?.dispose();
      this.childProcess?.kill();
    } catch (e: any) {
      this.logger.error(e.toString?.());
    }
  }
}
