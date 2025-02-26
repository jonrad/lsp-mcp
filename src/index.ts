#!/usr/bin/env node

import { nullLogger, errorLogger } from "./logger";
import { Command, OptionValues } from "commander";
import { Config, loadConfig } from "./config";
import { App } from "./app";
import { Logger } from "vscode-languageserver-protocol";

async function buildConfig(options: OptionValues, logger: Logger): Promise<Config> {
  let config: Config | undefined;

  if (options.config) {
    try {
      config = await loadConfig(options.config);
    } catch (e) {
      logger.error(`Failed to parse config file ${options.config}`);
      process.exit(1);
    }

    if (config === undefined) {
      logger.error(`Failed to parse config file ${options.config}`);
      process.exit(1);
    }
  } else {
    if (!options.lsp) {
      logger.error("No LSP command provided");
      process.exit(1);
    }

    config = {
      lsps: [
        {
          id: "lsp",
          extensions: [],
          languages: [],
          command: "sh",
          args: ["-c", options.lsp],
        },
      ],
      methods: options.methods,
    };
  }

  return config;
}

async function main() {
  const program = new Command();

  program
    .name("lsp-mcp")
    .description("A tool for providing LSP requests to MCP")
    .version("0.1.0")
    .option(
      "-m, --methods [string...]",
      "LSP methods to enabled (Default: all)",
    )
    .option(
      "-l, --lsp <string>",
      "LSP command to start (note: command is passed through sh -c)",
    )
    .option("-v, --verbose", "Verbose output (Dev only, don't use with MCP)")
    .option("-c, --config [string]", "Path to config file")
    .parse(process.argv);

  const options = program.opts();

  // UGH i really need to start using a proper logging lib
  const logger = options.verbose ? errorLogger : nullLogger;
  logger.info(`Running with: ${JSON.stringify(options)}`);

  const config = await buildConfig(options, logger);
  const app = new App(config, logger);

  try {
    await app.start();
  } catch (e: any) {
    logger.error(e.toString?.());
    process.exit(1);
  }
}

main();
