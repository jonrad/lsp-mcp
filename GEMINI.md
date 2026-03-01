# GEMINI.md - LSP MCP Context

## Project Overview

**LSP MCP** is a Model Context Protocol (MCP) server that exposes Language Server Protocol (LSP) capabilities to LLMs and AI agents. It acts as a bridge, allowing an AI to perform language-aware operations (like finding definitions, searching symbols, or getting type information) by dynamically wrapping LSP methods as MCP tools.

### Core Technologies

- **Language:** TypeScript (Node.js)
- **Frameworks:** `@modelcontextprotocol/sdk`, `vscode-languageserver-protocol`
- **Configuration:** `zod` for validation, `commander` for CLI
- **Schema Handling:** `@apidevtools/json-schema-ref-parser` for dereferencing LSP JSON schemas

## Architecture

The project follows a modular structure where LSP management is decoupled from the MCP server interface:

- **`App` (`src/app.ts`)**: The central coordinator that initializes the MCP server, manages the LSP lifecycle, and registers tools.
- **`LspManager` (`src/lsp-manager.ts`)**: Maintains a registry of active LSP clients, mapping them to specific languages or file extensions.
- **`LspClient` (`src/lsp.ts`)**: Handles the low-level JSON-RPC communication with external LSP servers over `stdio`.
- **`ToolManager` (`src/tool-manager.ts`)**: Manages the dynamic registration and invocation of MCP tools.
- **`LSP Method Discovery` (`src/lsp-methods.ts`)**: Automatically generates tool schemas and handlers by parsing `src/resources/metaModel.json` and `src/resources/generated.protocol.schema.json`.

## Development Workflows

### Prerequisites

- Node.js and Yarn
- (Optional) Docker for containerized execution

### Essential Commands

- **Install Dependencies:** `yarn install`
- **Build:** `yarn build` (Compiles TS to `dist/` and copies resources)
- **Run (Production):** `yarn start`
- **Run (Development):** `yarn dev --lsp "<lsp-command>"`
- **Linting:** `yarn lint`
- **Formatting:** `yarn format`
- **Testing:** `yarn test` (Uses Jest)

### Configuration

The server can be configured via a JSON file (passed with `--config`) or CLI arguments.
A typical configuration includes:

- `lsps`: An array of LSP server definitions (id, command, args, languages, extensions).
- `workspace`: The root directory for the LSP servers.
- `methods`: Optional list of specific LSP methods to expose as tools.

## Development Conventions

- **Surgical Updates:** Use `replace` for targeted edits; ensure type safety and consistent style.
- **LSP Integration:** When adding support for new LSP features, update the resources in `src/resources/` or adjust the blacklist in `src/lsp-methods.ts`.
- **Error Handling:** Use the provided logger (defined in `src/logger.ts`) to avoid polluting `stdout`, which is reserved for MCP communication.
- **Async First:** The codebase leverages `async/await` extensively for I/O operations with LSP servers.

## Key Files

- `src/index.ts`: CLI entry point and command-line parsing.
- `src/config.ts`: Zod schema for project configuration.
- `src/app.ts`: Main application logic and tool registration.
- `src/lsp.ts`: Implementation of the LSP JSON-RPC client.
- `src/mcp.ts`: MCP server initialization and transport setup.
- `src/resources/metaModel.json`: Source of truth for LSP request metadata.
