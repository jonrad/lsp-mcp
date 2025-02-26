import { LspMeta } from "./app";
import { LspClient } from "./lsp";

export class LspManager {
  private readonly lsps: Map<string, LspMeta>;
  private readonly languageToLsp: Map<string, LspMeta>;
  private readonly extensionToLsp: Map<string, LspMeta>;

  constructor(lsps: LspMeta[]) {
    this.lsps = new Map(lsps.map((lsp) => [lsp.id, lsp]));

    // Build language lookup map
    this.languageToLsp = new Map();
    this.extensionToLsp = new Map();
    for (const lsp of lsps) {
      for (const language of lsp.languages) {
        // TODO: handle conflict
        this.languageToLsp.set(language.toLowerCase(), lsp);
      }

      for (const extension of lsp.extensions) {
        // TODO: handle conflict
        this.extensionToLsp.set(extension.toLowerCase(), lsp);
      }
    }
  }

  getLsp(id: string): LspClient | undefined {
    return this.lsps.get(id)?.lsp;
  }

  getLsps(): LspClient[] {
    return Array.from(this.lsps.values()).map((lsp) => lsp.lsp);
  }

  getLspByLanguage(language: string): LspClient | undefined {
    return this.languageToLsp.get(language.toLowerCase())?.lsp;
  }

  getLspByExtension(extension: string): LspClient | undefined {
    return this.extensionToLsp.get(extension.toLowerCase())?.lsp;
  }
}
