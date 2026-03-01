# Plan 05: LSP Workspace Configuration Support

## 1. Why
LSP servers often require complex configuration (like `perlPath`, `includePaths`, or `lintingSeverities`) that cannot be easily passed via CLI arguments. By supporting the standard `workspace/configuration` request, we allow users to provide full JSON-based settings to the LSP through the MCP server.

## 2. How
**Files changed:**
- `src/config.ts` (Added optional `settings` field to the LSP schema)
- `src/lsp.ts` (Implemented the `workspace/configuration` request handler)
- `src/app.ts` (Modified `buildLsps` to pass settings)

**Steps:**
1. Apply the patch `05-lsp-settings.patch`.
2. Create a configuration JSON containing a `settings` block for your LSP.

## 3. Verification & Testing
- **Log Check:** Run the server with `--verbose`. Trigger an LSP tool. Verify that the log shows `Received workspace/configuration request`.
- **Functionality:** Set a specific setting that has a visible effect (e.g., disable a linter in the settings). Verify that the LSP respects this setting during execution.
