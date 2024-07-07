const win = typeof window !== "undefined" && window;

export class GetFile {
  private fileCache: Map<string, Promise<string>>;
  private fetchCache: Map<string, Promise<Response>>;

  constructor() {
    this.fileCache = new Map();
    this.fetchCache = new Map();
  }

  private _fetchResponse(file: string) {
    if (!win) {
      throw new Error(`No window`);
    }
    return win.fetch(file);
  }

  private async _readFile(file: string) {
    const fs = await import("fs-extra");
    return fs.default.readFile(file, "utf8");
  }

  fetchResponse(file: string) {
    let curr = this.fetchCache.get(file);
    if (curr) {
      return curr;
    }
    curr = this._fetchResponse(file);
    this.fetchCache.set(file, curr);
    return curr;
  }

  async fetch(file: string) {
    const r = await this.fetchResponse(file);
    return r.text();
  }

  readFile(file: string) {
    let curr = this.fileCache.get(file);
    if (curr) {
      return curr;
    }
    curr = this._readFile(file);
    this.fileCache.set(file, curr);
    return curr;
  }

  delete(file: string) {
    this.fileCache.delete(file);
    this.fetchCache.delete(file);
  }
}
