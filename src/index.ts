import { startLsp, initialize } from "./lsp";
async function main() {
  const lsp = await startLsp("sh", [
    "-c",
    "yarn --silent typescript-language-server --stdio --log-level 4 | tee lsp.log",
  ]);
  
  await initialize(lsp);
  console.log("Initialized");
  lsp.stop();
}

main();