# LSP MCP
## Warning
This is in a POC state. Do not use for any real work.

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
npx @wong2/mcp-cli --config mcp_config.json
```
### Decisions
* ~~Using python - I want to leverage a client library that makes the startup of this simple. A lot of LSPs are created in node, but the mature client libraries seem to be dependent on vscode. I like the look of [multilspy](https://github.com/microsoft/multilspy), so we'll start with python. It helps that I already created a python MCP, so at least I'll have a leg up there~~
* ~~[uv](https://docs.astral.sh/uv/)  for package management and such - I've been seeing this used more frequently lately and this is an excuse to learn it. Switching package managers in the future is annoying but doable. I may have to revisit this decision once implementing CI/CD. Maybe I can use this instead of a dependency on [taskfile](https://taskfile.dev/) as well? TBD~~
* Async when possible - It's 2025
* Switching to node after all. POC with python was more successful than I expected. But, multilspy doesn't support the entire LSP spec and vscode's library will be easier to work with as node is arguably the defacto standard language of LSP servers/clients. 

## References
* [Generated LSP JSON Schema](https://gist.github.com/bollwyvl/7a128978b8ae89ab02bbd5b84d07a4b7#file-generated-protocol-schema-json)