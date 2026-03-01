# Plan 03: Testing Infrastructure

## 1. Why
A codebase without tests is fragile. We need a solid testing foundation to verify core components (like the `App` and `LspClient`) remain healthy as the project grows. Adding Jest and a basic smoke test allows for automated validation of every PR.

## 2. How
**Files changed:**
- `jest.config.js` (New file)
- `src/__tests__/smoke.test.ts` (New file)
- `package.json` (Added `jest`, `ts-jest`, and `@types/jest` dependencies)

**Steps:**
1. Apply the patch `03-testing.patch`.
2. Run `yarn install`.
3. Run `yarn test`.

## 3. Verification & Testing
- **Execution:** Run `yarn test`. You should see `PASS src/__tests__/smoke.test.ts`.
- **Integration:** Confirm that `ts-jest` correctly compiles the TypeScript test file before execution.
- **Fail Check:** Temporarily change `expect(app).toBeDefined()` to `toBeUndefined()` and verify that the test fails as expected.
