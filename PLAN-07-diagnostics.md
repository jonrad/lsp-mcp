# Plan 07: New MCP Diagnostics Feature

## 1. Why
LLMs benefit from knowing about compiler and linter errors without having to guess. Standard LSP `publishDiagnostics` are notifications (one-way), which don't fit the MCP request model. By caching these notifications, we can expose a dedicated `get_diagnostics` tool that the AI can call to see current issues in a file.

## 2. How
**Files changed:**
- `src/lsp.ts` (Implemented `diagnosticsCache` and notification listener)
- `src/app.ts` (Registered the new `get_diagnostics` tool)

**Steps:**
1. Apply the patch `07-diagnostics.patch`.
2. Introduce a syntax error in a source file.
3. Call the `get_diagnostics` tool for that file URI.

## 3. Verification & Testing
- **New Tool:** Verify that `get_diagnostics` appears in the list of available MCP tools.
- **Accuracy:** Introduce an error (e.g., misspelled module name) and verify that the tool returns the specific error found by the LSP.
- **Empty State:** Verify that calling the tool on a valid file returns a friendly "No issues found." message.
