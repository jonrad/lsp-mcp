#!/usr/bin/env node

import { nullLogger, errorLogger } from "./logger";
import { Command, OptionValues } from "commander";
import { Config, loadConfig } from "./config";
import { App } from "./app";
import { Logger } from "vscode-languageserver-protocol";

async function buildConfig(
  options: OptionValues,
  logger: Logger,
): Promise<Config> {
  let config: Config | undefined;

  if (options.config) {
    try {
      config = await loadConfig(options.config);
    } catch (e: any) {
      logger.error(
        `Failed to parse config file ${options.config}: ${e?.message ?? e}`,
      );
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

    const shell = process.platform === "win32" ? "cmd.exe" : "sh";
    const shellArg = process.platform === "win32" ? "/c" : "-c";

    config = {
      lsps: [
        {
          id: "lsp",
          extensions: [],
          languages: [],
          command: shell,
          args: [shellArg, options.lsp],
        },
      ],
    };
  }

  if (options.methods) {
    config.methods = options.methods;
  }

  if (options.workspace) {
    config.workspace = options.workspace;
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
    .option(
      "-w, --workspace [string]",
      "Path to the workspace to use for the LSP. Defaults to /",
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

  // Ensure clean exit when stdin closes (e.g. when piping a single request)
  process.stdin.on("end", async () => {
    // Give it a moment to finish any pending work
    setTimeout(async () => {
      await app.dispose();
      process.exit(0);
    }, 100);
  });

  try {
    await app.start();
  } catch (e: any) {
    logger.error(e.toString?.());
    process.exit(1);
  }
}

main();
