import { LspClient } from "./lsp";

export class LspManager {
  private readonly lsps: Map<string, LspClient>;
  private readonly languageToLsp: Map<string, LspClient>;
  private readonly extensionToLsp: Map<string, LspClient>;
  private readonly defaultLsp: LspClient;

  constructor(lsps: LspClient[]) {
    this.defaultLsp = lsps[0];
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

      this.extensionToLsp.set(lsp.id, lsp);
    }
  }

  getLsp(id: string): LspClient | undefined {
    return this.lsps.get(id);
  }

  getLsps(): LspClient[] {
    return Array.from(this.lsps.values()).map((lsp) => lsp);
  }

  getLspByLanguage(language: string): LspClient | undefined {
    return this.languageToLsp.get(language.toLowerCase());
  }

  getLspByExtension(extension: string): LspClient | undefined {
    return this.extensionToLsp.get(extension.toLowerCase());
  }

  getDefaultLsp(): LspClient {
    return this.defaultLsp;
  }

  hasManyLsps(): boolean {
    return this.lsps.size > 1;
  }
}
