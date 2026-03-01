# Meta Plan: Layered Patch Generation

This meta-plan describes the surgical process for splitting the comprehensive "checkpoint" work into logical, reviewable layers.

## Process
1. **Reset to Base:**
   `git reset --hard b48c04c`
   (Ensures a clean starting point from the original upstream state).

2. **Layer 1: Prettier Configuration**
   - Apply `.prettierignore` and `package.json` format script updates.
   - Commit: `git commit -m "layer 01: prettier configuration"`

3. **Layer 2: Linting Configuration**
   - Apply `eslint.config.js` and `package.json` lint script updates.
   - Apply minor linting fixes (underscores for unused variables).
   - Commit: `git commit -m "layer 02: linting configuration"`

4. **Layer 3: Testing Infrastructure**
   - Apply Jest dependencies to `package.json`.
   - Apply `jest.config.js` and `smoke.test.ts`.
   - Commit: `git commit -m "layer 03: testing infrastructure"`

5. **Layer 4: Windows Compatibility Fixes**
   - Apply shell spawning fixes (`cmd.exe`), cross-platform build scripts, and robust URI/Path resolution logic.
   - Apply the corrected `Initialize` handshake.
   - Commit: `git commit -m "layer 04: windows compatibility fixes"`

6. **Layer 5: LSP Workspace Configuration Support**
   - Apply the `settings` field to the configuration schema and the `workspace/configuration` request handler.
   - Commit: `git commit -m "layer 05: lsp workspace configuration support"`

7. **Layer 6: AI Prompt Quality & Formatting**
   - Apply recursive `formatResult`, entity decoding, and the global retry mechanism.
   - Commit: `git commit -m "layer 06: ai prompt quality & formatting"`

8. **Layer 7: New MCP Diagnostics Feature**
   - Apply notification caching and the new `get_diagnostics` tool.
   - Commit: `git commit -m "layer 07: new mcp diagnostics feature"`

9. **Layer 8: Documentation**
   - Apply the comprehensive `GEMINI.md` project context file.
   - Commit: `git commit -m "layer 08: project documentation (GEMINI.md)"`

10. **Final Generation:**
    Generate all patches: `git format-patch b48c04c..HEAD`
    (This creates 8 numbered `.patch` files ready for individual PRs).
