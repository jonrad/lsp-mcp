import { ChildProcess, spawn } from "child_process";
import * as rpc from "vscode-jsonrpc";
import { StreamMessageReader, StreamMessageWriter } from "vscode-jsonrpc/node";
import { InitializeRequest } from "vscode-languageserver-protocol";
import * as protocol from "vscode-languageserver-protocol";
import { Logger } from "vscode-jsonrpc";
import { pathToFileURL } from "url";

export interface LspClient {
  id: string;
  languages: string[];
  extensions: string[];
  capabilities: protocol.ServerCapabilities | undefined;
  settings: any | undefined;
  getDiagnostics(uri: string): protocol.Diagnostic[];
  start(): Promise<void>;
  isStarted(): boolean;
  dispose: () => void;
  sendRequest(method: string, args: any): Promise<any>;
  sendNotification(method: string, args: any): Promise<void>;
}

export class LspClientImpl implements LspClient {
  protected childProcess: ChildProcess | undefined;

  protected connection: rpc.MessageConnection | undefined;

  public capabilities: protocol.ServerCapabilities | undefined;

  private diagnosticsCache: Map<string, protocol.Diagnostic[]> = new Map();

  public constructor(
    public readonly id: string,
    public readonly languages: string[],
    public readonly extensions: string[],
    public readonly workspace: string,
    private readonly command: string,
    private readonly args: string[],
    private readonly logger: Logger, // TODO: better long term solution for logging
    public readonly settings: any | undefined = undefined,
  ) {
    this.capabilities = undefined;
  }

  public getDiagnostics(uri: string): protocol.Diagnostic[] {
    return this.diagnosticsCache.get(uri) || [];
  }

  public async start() {
    // TODO: This should return a promise if the LSP is still starting
    // Just don't call start() twice and it'll be fine :)
    if (this.isStarted()) {
      return;
    }

    const childProcess = (this.childProcess = spawn(this.command, this.args));

    if (!childProcess.stdout || !childProcess.stdin) {
      throw new Error("Child process not started");
    }

    const connection = (this.connection = rpc.createMessageConnection(
      new StreamMessageReader(childProcess.stdout),
      new StreamMessageWriter(childProcess.stdin),
      this.logger,
    ));

    connection.onError((error) => {
      this.logger.error(`Connection error: ${error}`);
      childProcess.kill();
    });

    connection.onClose(() => {
      this.logger.log("Connection closed");
      childProcess.kill();
    });

    connection.onNotification(
      protocol.PublishDiagnosticsNotification.type,
      (params) => {
        this.diagnosticsCache.set(params.uri, params.diagnostics);
      },
    );

    connection.onUnhandledNotification((notification) => {
      this.logger.log(
        `Unhandled notification: ${JSON.stringify(notification)}`,
      );
    });

    connection.onRequest(protocol.ConfigurationRequest.type, (params) => {
      this.logger.info(
        `Received workspace/configuration request: ${JSON.stringify(params)}`,
      );
      return params.items.map((item) => {
        if (item.section && this.settings && this.settings[item.section]) {
          return this.settings[item.section];
        }
        return this.settings || {};
      });
    });

    connection.listen();

    // TODO: We should figure out how to specify the capabilities we want
    const capabilities: protocol.ClientCapabilities = {
      workspace: {
        configuration: true,
      },
    };

    const uri = pathToFileURL(this.workspace).toString();
    const response = await connection.sendRequest(InitializeRequest.type, {
      processId: process.pid,
      rootUri: uri,
      capabilities: capabilities,
    });

    this.capabilities = response.capabilities;
  }

  public isStarted(): this is LspClientImpl & {
    connection: rpc.MessageConnection;
  } {
    return !!this.connection;
  }

  private assertStarted(): asserts this is LspClientImpl & {
    connection: rpc.MessageConnection;
  } {
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
