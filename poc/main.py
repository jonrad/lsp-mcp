from typing import Callable
from multilspy import LanguageServer
from multilspy.multilspy_config import MultilspyConfig
from multilspy.multilspy_logger import MultilspyLogger
from mcp.server.fastmcp import FastMCP
from mcp.types import (
    Tool as MCPTool,
)
import inspect
import os
import asyncio
import logging

logger = logging.getLogger(__name__)
cwd = os.getcwd()

def get_relative_path(file_path: str) -> str:
    return os.path.join(cwd, file_path)

def build_mcp(lsp: LanguageServer) -> FastMCP:
    mcp = FastMCP("lsp")
    fns = [
        lsp.request_document_symbols,
        lsp.request_definition,
        lsp.request_references,
        lsp.request_completions,
        lsp.request_hover,
    ]

    for fn in fns:
        add_tool(mcp, fn)
    return mcp

def add_tool(mcp: FastMCP, fn: Callable) -> MCPTool:
    mcp.add_tool(fn=fn, name="lsp_" + fn.__name__, description=inspect.getdoc(fn))

async def main():
    lsp = LanguageServer.create(
        MultilspyConfig.from_dict({"code_language": "python"}),
        MultilspyLogger(),
        cwd,
    )

    mcp = build_mcp(lsp)

    logger.info("LSP starting...")
    async with lsp.start_server():
        logger.info("LSP started")

        await mcp.run_stdio_async()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        logger.error(f"Error: {e}")
        raise e
