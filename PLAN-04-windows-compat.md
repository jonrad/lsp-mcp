# Plan 04: Windows Compatibility Fixes

## 1. Why
The application was originally designed for Linux/Unix environments (using `sh -c` and `cp`). To make it usable for Windows developers and to support tools like `PerlNavigator.exe`, we must use platform-aware shell spawning and robust URI-to-path resolution that correctly handles drive letters and backslashes.

## 2. How
**Files changed:**
- `package.json` (Cross-platform `build` script using `node -e`)
- `src/index.ts` (Dynamic shell selection: `cmd.exe` vs `sh`, plus clean `stdin` exit)
- `src/lsp-methods.ts` (Robust path/URI conversion using `url` module and `languageId` fix)
- `src/lsp.ts` (Handshake fix: correctly formatted `rootUri` via `pathToFileURL`)

**Steps:**
1. Apply the patch `04-windows-compat.patch`.
2. Run `yarn build`.

## 3. Verification & Testing
- **Build Script:** Run `yarn build`. Verify that resources are correctly copied to `dist/resources` on a Windows machine.
- **Process Spawning:** Run the server with an absolute path to a Windows `.exe` (e.g., `perlnavigator.exe`). It should no longer throw `sh ENOENT`.
- **Path Resolution:** Use a tool call with a `file:///C:/...` URI. Verify in the logs that it is correctly converted to a local Windows path without double drive letters.
- **Shutdown:** Pipe a single request into the server. Verify that it processes the request and exits automatically without hanging.
