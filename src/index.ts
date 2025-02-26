#!/usr/bin/env node

import fs from "fs/promises";
import { LspClientImpl } from "./lsp";
import { createMcp } from "./mcp";
import { getLspMethods } from "./lsp-methods";
import { nullLogger, consoleLogger, errorLogger } from "./logger";
import { Command } from "commander";
import { Config } from "./config";
import { App, buildLsps } from "./app";
import { LspManager } from "./lsp-manager";
import stripJsonComments from "strip-json-comments";
import { Logger } from "vscode-languageserver-protocol";

async function mainConfig(
  config: Config,
  methods: string[] | undefined = undefined,
  logger: Logger = nullLogger,
) {
  const lspMethods = await getLspMethods(methods);

  const lsps = new LspManager(buildLsps(config.lsps, logger));
  const mcp = createMcp();

  const app = new App(
    lsps,
    lspMethods,
    mcp,
    logger
  );

  await app.start();
}

async function main() {
  const program = new Command();

  program
    .name("lsp-mcp")
    .description("A tool for providing LSP requests to MCP")
    .version("0.1.0")
    .option("-m, --methods [string...]", "LSP methods to enabled (Default: all)")
    .option(
      "-l, --lsp [string]",
      "LSP command to start (note: command is passed through sh -c)",
      // TODO: move this to package.json or something
      `npx -y typescript-language-server --stdio`
    )
    .option("-v, --verbose", "Verbose output (Dev only, don't use with MCP)")
    .option("-c, --config [string]", "Path to config file")
    .parse(process.argv);

  const options = program.opts();

  const logger = options.verbose ? errorLogger : nullLogger;

  logger.info(`Running with: ${JSON.stringify(options)}`);
  if (options.config) {
    const config = JSON.parse(
      stripJsonComments(
        await fs.readFile(options.config, "utf8")
      )
    );
    await mainConfig(
      config,
      options.methods,
      logger
    );
  } else {
    await mainConfig(
      {
        lsps: [{
          id: "lsp",
          extensions: [],
          languages: [],
          command: "sh",
          args: ["-c", options.lsp],
        }]
      },
      options.methods,
      logger
    );
  }
}

main();
