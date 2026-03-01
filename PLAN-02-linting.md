# Plan 02: Linting Configuration

## 1. Why
To maintain code quality and catch bugs early (like unused variables or unawaited promises), we need a modern linting setup. Switching to the ESLint Flat Config (`eslint.config.js`) ensures we follow the latest industry standards and can specifically ignore generic types needed for LSP handling.

## 2. How
**Files changed:**
- `eslint.config.js` (New file)
- `package.json` (Updated `lint` script)
- Various source files (Minor cleanups like `_e` for unused variables)

**Steps:**
1. Apply the patch `02-linting.patch`.
2. Run `yarn lint`.

## 3. Verification & Testing
- **Command:** Run `yarn lint`. It should execute without Errors.
- **Rules:** Confirm that unawaited promises or missing `await` in `App.ts` are now correctly identified (try removing an `await` to see it fail).
- **Warnings:** A few minor warnings for underscore-prefixed variables (e.g., `_e`) are acceptable and confirm the rule is working.
