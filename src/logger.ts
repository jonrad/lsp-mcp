import { Logger } from "vscode-jsonrpc";

function formatMessage(message: string) {
  if (!message.endsWith("\n")) {
    message += "\n";
  }

  return message;
}

export const errorLogger: Logger = {
  error: (message: string) => {
    console.error(formatMessage(message));
  },
  warn: (message: string) => {
    console.warn(formatMessage(message));
  },
  info: (message: string) => {
    console.info(formatMessage(message));
  },
  log: (message: string) => {
    console.log(formatMessage(message));
  },
};

export const consoleLogger: Logger = {
  error: (message: string) => {
    console.error(formatMessage(message));
  },
  warn: (message: string) => {
    console.warn(formatMessage(message));
  },
  info: (message: string) => {
    console.info(formatMessage(message));
  },
  log: (message: string) => {
    console.log(formatMessage(message));
  },
};

export const nullLogger: Logger = {
  error: (message: string) => {
  },
  warn: (message: string) => {
  },
  info: (message: string) => {
  },
  log: (message: string) => {
  },
};
