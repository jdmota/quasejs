import fsextra from "fs-extra";
import { never } from "../../../util/miscellaneous";
import { IncrementalComputationDescription } from "../descriptions/computations";
import { serializationDB } from "../../utils/serialization-db";
import type { IncrementalBackend } from "../runtime/backend";
import {
  type StateNotCreating,
  type StateNotDeleted,
  IncrementalComputationRuntime,
} from "../runtime/computations";
import { IncrementalCellRuntime } from "../runtime/cells";
import { valueDesc, type ValueDescription } from "../descriptions/values";
import type { IncrementalCellDescription } from "../descriptions/cells";
import { FileSystem, FileChange } from "./file-system";

type FileComputationDescriptionJSON = {
  readonly path: string;
  readonly type: FileChange;
  readonly recursive: boolean;
};

export class FileComputationDescription extends IncrementalComputationDescription<FileComputation> {
  readonly path: string;
  readonly type: FileChange;
  readonly recursive: boolean;
  readonly json: string;

  constructor(path: string, type: FileChange, recursive: boolean) {
    super();
    this.path = path;
    this.type = type;
    this.recursive = recursive;
    this.json = JSON.stringify({ path, type, recursive });
  }

  create(backend: IncrementalBackend): FileComputation {
    return new FileComputation(backend, this);
  }

  equal(other: unknown): boolean {
    return (
      other instanceof FileComputationDescription &&
      this.path === other.path &&
      this.type === other.type &&
      this.recursive === other.recursive
    );
  }

  hash() {
    return this.path.length + 31 * this.type.length + (this.recursive ? 1 : 2);
  }

  getOutputDef(): ValueDescription<bigint, any> {
    return valueDesc(
      (a, b) => (this.recursive ? false : a === b),
      val => 0,
      val => val,
      val => val
    );
  }

  isCacheable(): boolean {
    return !this.recursive;
  }

  getCacheKey() {
    return this.json;
  }

  format() {
    return `File(${this.path},${this.type},${this.recursive})`;
  }
}

serializationDB.register<
  FileComputationDescription,
  FileComputationDescriptionJSON
>(FileComputationDescription, {
  name: "FileComputationDescription",
  serialize(value) {
    return {
      path: value.path,
      type: value.type,
      recursive: value.recursive,
    };
  },
  deserialize({ path, type, recursive }) {
    return new FileComputationDescription(path, type, recursive);
  },
});

async function getTimestamp(desc: FileComputationDescription) {
  if (desc.recursive) {
    return 0n;
  }
  const { birthtimeNs, mtimeNs } = await fsextra.stat(desc.path, {
    bigint: true,
  });
  switch (desc.type) {
    case FileChange.ADD_OR_REMOVE:
      return birthtimeNs;
    case FileChange.CHANGE:
      return mtimeNs;
    default:
      never(desc.type);
  }
}

export class FileComputation extends IncrementalComputationRuntime<
  null,
  bigint
> {
  readonly fs: FileSystem;

  constructor(
    backend: IncrementalBackend,
    readonly desc: FileComputationDescription
  ) {
    super(backend, desc);
    this.fs = backend.fs;
  }

  externalInvalidate() {
    this.backend.externalInvalidate(this);
  }

  override getCell<Value>(
    desc: IncrementalCellDescription<Value>
  ): IncrementalCellRuntime<Value> | undefined {
    if (this.outputCell.desc.equal(desc)) {
      return this.outputCell as any;
    }
  }

  override onReadCell<Value>(cell: IncrementalCellRuntime<Value>) {
    if (!cell.desc.resolved) {
      // Ensure progress
      this.maybeRun();
    }
  }

  protected createContext() {
    return null;
  }

  protected async exec(ctx: null) {
    if (this.backend.invalidationsAllowed()) {
      await this.fs.sub(this);
    }
    return getTimestamp(this.desc);
  }

  protected async reloadRoutine(ctx: null): Promise<boolean> {
    if (this.backend.invalidationsAllowed()) {
      await this.fs.sub(this);
    }
    const cached = this.backend.db!.getCell(this.outputCell.desc);
    const currentTimestamp = await getTimestamp(this.desc);
    if (cached != null && currentTimestamp === cached.value) {
      this.outputCell._set(cached.value, cached.version);
    } else {
      this.outputCell.set(currentTimestamp);
    }
    return true;
  }

  protected finishRoutine() {
    if (this.isCacheable) {
      this.backend.db!.saveCell(this.outputCell);
    }
  }

  protected invalidateRoutine() {}

  protected deleteRoutine() {
    this.fs.unsub(this);

    if (this.isCacheable) {
      this.backend.db!.unsaveCell(this.outputCell);
    }
  }

  override isOrphan(): boolean {
    // TODO
    return false;
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating) {}
}
