import { Logger } from "vscode-jsonrpc";

export const consoleLogger: Logger = {
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