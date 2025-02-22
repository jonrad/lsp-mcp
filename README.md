# MCP LSP POC
## The ABCs (Introduction)
### What is an MCP?
* [MCP](https://modelcontextprotocol.io/) - Documentation
* [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) - MCP Server Python Library
### What is an LSP?
* [LSP](https://microsoft.github.io/language-server-protocol/) - Documentation
* [multilspy](https://github.com/microsoft/multilspy) - LSP Python Client Library
## Development
### Dependencies
* [uv](https://docs.astral.sh/uv/)
### Running
### Testing
### Debugging
### Helpful Scripts
Putting these here until I make a decision on how to handle them (uv or task or something else)
```
# Helpful MCP Client without actually using an LLM (Call your tools directly)
npx @wong2/mcp-cli --config config.json
```
### Decisions
* Using python - I want to leverage a client library that makes the startup of this simple. A lot of LSPs are created in node, but the mature client libraries seem to be dependent on vscode. I like the look of [multilspy](https://github.com/microsoft/multilspy), so we'll start with python. It helps that I already created a python MCP, so at least I'll have a leg up there
* [uv](https://docs.astral.sh/uv/)  for package management and such - I've been seeing this used more frequently lately and this is an excuse to learn it. Switching package managers in the future is annoying but doable. I may have to revisit this decision once implementing CI/CD. Maybe I can use this instead of a dependency on [taskfile](https://taskfile.dev/) as well? TBD
* Async when possible - It's 2025
