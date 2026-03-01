# Plan 06: AI Prompt Quality & Result Formatting

## 1. Why
Providing the AI with raw JSON blobs containing escaped newlines (`\n`) and HTML entities (`&#039;`) is inefficient and reduces the AI's "intelligence." By cleaning up documentation and using a retry mechanism for background analysis lag, we provide the LLM with a high-quality "Senior Engineer" level prompt.

## 2. How
**Files changed:**
- `src/app.ts` (Implemented recursive `formatResult` and `cleanText` helper; added global retry logic)

**Steps:**
1. Apply the patch `06-prompt-quality.patch`.
2. Call a tool like `textDocument_hover` via an MCP client.

## 3. Verification & Testing
- **Output Inspection:** Call `textDocument_hover` for a module like `Carp`. Verify that the output is clean Markdown with REAL line breaks and `'` instead of `&#039;`.
- **Retry Logic:** Observe the terminal logs. If the LSP returns `null` initially, verify that the server logs a "retrying" message and eventually returns the correct result.
