# LSP MCP
An Model Context Protocol (MCP) server that provides LLMs/AI Agents with the capabilities of a language server protocol (LSP) server. This gives the AI the ability to get language aware context from the codebase.

### Example

**Input:**
```
Use lsp to give me insights into the following typescript code:

let foo = "bar";
function x() {
  let foo = 123;
  console.log(foo);
}
x();
console.log(foo);
```

**Output:**
```
I'll use LSP (Language Server Protocol) to analyze your TypeScript code. Let me break down what's happening:
Here's what the code does and the insights from LSP analysis:

1. Variable Shadowing:

There are two variables named foo:

A global foo (string type) initialized with the value "bar"
A local foo (number type) inside the function x() initialized with the value 123

2. Execution Flow:

First, the global foo is declared and assigned the value "bar"
When function x() is called, the local foo variable is declared and assigned 123
The console.log(foo) inside the function outputs 123 (the local variable)
After the function finishes, console.log(foo) outputs "bar" (the global variable)

3. Scope Isolation:

The LSP confirms that TypeScript correctly identifies the different types:

The global foo is a string type
The local foo inside the function is a number type

Changes to the local foo don't affect the global foo

This is a classic example of variable shadowing in JavaScript/TypeScript, where a local variable with the same name as a global variable takes precedence within its scope.
```

## Warning
This is in a POC state.

## Quick Start
### Claude Desktop

#### Using Docker (Recommended)

Modify `claude_desktop_config.json` (As described in the [MCP Docs](https://modelcontextprotocol.io/quickstart/user#2-add-the-filesystem-mcp-server)) with the following:
```json
{
  "mcpServers": {
    "lsp": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "docker.io/jonrad/lsp-mcp:0.2.0"]
    }
  }
}
```

You'll likely want to share some files with the container by passing docker `-v /local_dir:/remote_dir`. Then you can ask Claude about the files in `/remote_dir/<filename>`.

#### Using npx
Note: Claude Desktop is finicky with npx it seems. Sometimes it says the mcp fails but the tools still work. I'll look into this... later 😊

```json
{
  "mcpServers": {
    "lsp": {
      "command": "npx",
      "args": ["-y", "--silent", "git+https://github.com/jonrad/lsp-mcp", "--lsp", "npx -y --silent -p 'typescript@5.7.3' -p 'typescript-language-server@4.3.3' typescript-language-server --stdio"]
    }
  }
}
```

This will provide Claude with the LSP capabilities of the typescript language server. You can modify the language server by switching the `--lsp` argument (and then restarting Claude).

Multiple LSPs at the same time is not yet supported.

### [MCP CLI Client](https://github.com/adhikasp/mcp-client-cli)
Follow the instructions for Claude but the config file is located in `~/.llm/config.json`


## The ABCs (Introduction)
### What is an MCP?
* [MCP](https://modelcontextprotocol.io/) - Documentation
* [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) - MCP Server Python Library
### What is an LSP?
* [LSP](https://microsoft.github.io/language-server-protocol/) - Documentation
* [multilspy](https://github.com/microsoft/multilspy) - LSP Python Client Library
## Development
```bash
yarn
yarn mcp-cli # Interactive MCP tool to help with development
yarn dev --help # Get the CLI help
```
### Dependencies
### Decisions
* ~~Using python - I want to leverage a client library that makes the startup of this simple. A lot of LSPs are created in node, but the mature client libraries seem to be dependent on vscode. I like the look of [multilspy](https://github.com/microsoft/multilspy), so we'll start with python. It helps that I already created a python MCP, so at least I'll have a leg up there~~
* ~~[uv](https://docs.astral.sh/uv/)  for package management and such - I've been seeing this used more frequently lately and this is an excuse to learn it. Switching package managers in the future is annoying but doable. I may have to revisit this decision once implementing CI/CD. Maybe I can use this instead of a dependency on [taskfile](https://taskfile.dev/) as well? TBD~~
* Async when possible - It's 2025
* Switching to node after all. POC with python was more successful than I expected. But, multilspy doesn't support the entire LSP spec and vscode's library will be easier to work with as node is arguably the defacto standard language of LSP servers/clients.
* Using the low-level MCP SDK. I think I'll need more control and it's frankly not that complicated as compared to the higher level FastMCP.
* Using [zod](https://zod.dev/) for config validation. It's already a dependency for the MCP SDK, so no reason to overthink it.
* I've set to always use an LSP even for unknown languages (eg LLM provides a textDocument/documentSymbol request for python but there is no python LSP registered). I'll probably revisit this decision.
* Decided to make the LSPs start only when they are asked something. May make configurable later, but for now this prevents overuse of resources.

### Roadmap
This is just a list of things I'd like to do eventually. There is no timeline or order for these.
* Figure out how to sync capabilities between the LSP client (this) and the LSP server
* Auto generated the LSP JSON Schema or find where it's published
* Make json schema a cli argument so we don't have the update code to support new ones
* Connect to an already running LSP server (via a multiplexing LSP server?)
* Switch to (Taskfile)[https://taskfile.dev/]
* Create a proper release process

## References
* [Generated LSP JSON Schema](https://gist.github.com/bollwyvl/7a128978b8ae89ab02bbd5b84d07a4b7#file-generated-protocol-schema-json)
