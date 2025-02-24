import { Tool } from "@modelcontextprotocol/sdk/types.js";

const tool: Tool = {
    name: "getSymbols",
    inputSchema: {
        type: "object",
        properties: {
            file: { type: "string" },
        },
    },
    // name: protocol.DocumentSymbolRequest.method, // name
    // "Get the symbols in a file", // description
    // { file: z.string() }, // args
    // async ({ file }) => {
}
//export const getSymbols = Tool({