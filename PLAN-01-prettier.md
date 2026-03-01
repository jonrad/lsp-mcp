# Plan 01: Prettier Configuration

## 1. Why
We need a solid formatting configuration to avoid wasting time manually formatting code. By adding a `.prettierignore` and refining the format script, we ensure that only relevant source files are processed, skipping large generated JSON schemas and build artifacts. This keeps the git history clean and prevents "noise" changes.

## 2. How
**Files changed:**
- `.prettierignore` (New file)
- `package.json` (Updated `format` script)

**Steps:**
1. Apply the patch `01-prettier.patch`.
2. Run `yarn install` (to ensure prettier is available).
3. Run `yarn format`.

## 3. Verification & Testing
- **Execution Speed:** Verify that `yarn format` completes in under 3 seconds.
- **Ignore Rules:** Check `git status` after formatting. Large resource files in `src/resources/*.json` and the `dist/` folder should NOT show any changes.
- **Targeting:** Verify that a minor formatting change in a `src/*.ts` file is correctly fixed by the command.
