import fs from "fs-extra";
import { joinSourceMaps } from "@quase/source-map";
import {
  Options,
  WatchedFiles,
  AssetRequest,
  DependencyRequest,
  WatchedFileInfo,
  DepRequestAndParent,
} from "../types";
import { resolvePath, makeAbsolute } from "../utils/path";
import { get } from "../utils/get";
import { createDiagnostic, DiagnosticOpts } from "../utils/error";

const ONLY_EXISTANCE: Readonly<{ onlyExistance: true }> = {
  onlyExistance: true,
};

export class BuilderUtil {
  readonly builderOptions: any;
  readonly warnings: string[];
  private readonly files: WatchedFiles;

  constructor(builderOptions: Options, files?: WatchedFiles) {
    const {
      mode,
      context,
      entries,
      dest,
      cwd,
      publicPath,
      runtime,
      hmr,
      optimization,
    } = builderOptions;
    this.builderOptions = {
      mode,
      context,
      entries,
      dest,
      cwd,
      publicPath,
      runtime,
      hmr,
      optimization,
    };
    this.files = files || new Map();
    this.warnings = [];
  }

  warn(text: string) {
    this.warnings.push(text);
  }

  createDiagnostic(diagnostic: DiagnosticOpts) {
    return createDiagnostic(diagnostic);
  }

  get<K, V>(map: ReadonlyMap<K, V>, key: K): V {
    return get(map, key);
  }

  joinSourceMaps(maps: any[]) {
    maps = maps.filter(Boolean);
    if (maps.length === 0) {
      return null;
    }
    if (maps.length === 1) {
      return {
        ...maps[0],
      };
    }
    return joinSourceMaps(maps);
  }

  isDest(id: string): boolean {
    return id.indexOf(this.builderOptions.dest) === 0;
  }

  createFakePath(key: string): string {
    return resolvePath(`_quase_builder_/${key}`, this.builderOptions.context);
  }

  isFakePath(path: string): boolean {
    return path.startsWith(
      resolvePath("_quase_builder_", this.builderOptions.context)
    );
  }

  wrapInJsPropKey(string: string): string {
    return /^[$_a-zA-Z][$_a-zA-Z0-9]*$/.test(string)
      ? string
      : JSON.stringify(string);
  }

  wrapInJsString(string: string): string {
    return JSON.stringify(string);
  }

  registerFile(
    _file: string,
    { onlyExistance }: { onlyExistance?: boolean } = {}
  ) {
    const time = Date.now();
    const file = makeAbsolute(_file);
    const curr = this.files.get(file);
    if (curr == null) {
      this.files.set(file, {
        time,
        onlyExistance,
      });
    } else if (!onlyExistance && curr) {
      curr.onlyExistance = false;
    }
  }

  getFiles(): ReadonlyMap<string, WatchedFileInfo> {
    return this.files;
  }

  stat(file: string) {
    this.registerFile(file);
    return fs.stat(file);
  }

  readFile(file: string, enconding?: string): Promise<string | Buffer> {
    this.registerFile(file);
    return enconding ? fs.readFile(file, enconding) : fs.readFile(file);
  }

  readdir(folder: string): Promise<string[]> {
    this.registerFile(folder);
    return fs.readdir(folder);
  }

  async isFile(file: string): Promise<boolean> {
    this.registerFile(file, ONLY_EXISTANCE);
    try {
      const s = await fs.stat(file);
      return s.isFile() || s.isFIFO();
    } catch (err) {
      if (err.code === "ENOENT" || err.code === "ENOTDIR") {
        return false;
      }
      throw err;
    }
  }

  async isDirectory(file: string): Promise<boolean> {
    this.registerFile(file, ONLY_EXISTANCE);
    try {
      const s = await fs.stat(file);
      return s.isDirectory();
    } catch (err) {
      if (err.code === "ENOENT" || err.code === "ENOTDIR") {
        return false;
      }
      throw err;
    }
  }

  dataToString(data: string | Buffer | Uint8Array): string {
    if (data instanceof Buffer) {
      return data.toString();
    }
    if (data instanceof Uint8Array) {
      return Buffer.from(data).toString();
    }
    return data;
  }
}

export class TransformContext extends BuilderUtil {
  readonly request: AssetRequest;

  constructor(builderOptions: Options, request: AssetRequest) {
    super(builderOptions);
    this.request = request;
  }
}

export class ResolveContext extends BuilderUtil {
  readonly request: DepRequestAndParent;

  constructor(builderOptions: Options, request: DepRequestAndParent) {
    super(builderOptions);
    this.request = request;
  }
}
