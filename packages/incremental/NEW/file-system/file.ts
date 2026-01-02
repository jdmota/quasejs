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
import { type ChangedValue, sameValue } from "../descriptions/values";
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

  getCacheKey() {
    return this.json;
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

export class FileComputation extends IncrementalComputationRuntime<
  null,
  bigint
> {
  readonly fs: FileSystem;
  readonly outputCell: IncrementalCellRuntime<bigint>;

  constructor(
    backend: IncrementalBackend,
    readonly desc: FileComputationDescription
  ) {
    super(backend, desc);
    this.fs = backend.fs;
    this.outputCell = new IncrementalCellRuntime(
      backend,
      this,
      sameValue<bigint>(),
      "",
      0,
      false
    );
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
    if (this.desc.recursive) {
      return 0n;
    }
    // await this.cacheableMixin.preExec();
    const { birthtimeNs, mtimeNs } = await fsextra.stat(this.desc.path, {
      bigint: true,
    });
    switch (this.desc.type) {
      case FileChange.ADD_OR_REMOVE:
        return birthtimeNs;
      case FileChange.CHANGE:
        return mtimeNs;
      default:
        never(this.desc.type);
    }
  }

  protected override isAlone(): boolean {
    // TODO
    return false;
  }

  // TODO
  responseEqual(a: bigint, b: bigint): boolean {
    return this.desc.recursive ? false : a === b;
  }

  protected setOutputValue(value: bigint) {
    return this.outputCell.set(value);
  }

  protected finishRoutine(set: ChangedValue<bigint>) {}

  protected invalidateRoutine() {
    this.outputCell.setPending();
  }

  protected deleteRoutine() {
    this.fs.unsub(this);
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating) {}
}
