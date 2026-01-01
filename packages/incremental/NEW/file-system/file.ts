import { IncrementalComputationDescription } from "../descriptions/computations";
import { serializationDB } from "../../utils/serialization-db";
import type { IncrementalBackend } from "../runtime/backend";
import { FileChange } from "./file-system";
import {
  IncrementalComputationRuntime,
  type StateNotCreating,
  type StateNotDeleted,
} from "../runtime/computations";

type FileComputationDescriptionJSON = {
  readonly path: string;
  readonly type: FileChange;
  readonly recursive: boolean;
};

export class FileComputationDescription
  extends IncrementalComputationDescription<FileComputation>
  implements FileComputationDescriptionJSON
{
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
  void,
  bigint
> {
  public readonly fs: FileSystem;

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

  protected createContext() {}

  protected async exec(
    ctx: RawComputationContext
  ): Promise<ComputationResult<bigint>> {
    if (this.registry.invalidationsAllowed()) {
      await this.fs._sub(this);
    }
    if (this.desc.recursive) {
      return ok(0n);
    }
    await this.cacheableMixin.preExec();
    const { birthtimeNs, mtimeNs } = await fsextra.stat(this.desc.path, {
      bigint: true,
    });
    switch (this.desc.type) {
      case FileChange.ADD_OR_REMOVE:
        return ok(birthtimeNs);
      case FileChange.CHANGE:
        return ok(mtimeNs);
      default:
        never(this.desc.type);
    }
  }

  protected finishRoutine(result: VersionedComputationResult<bigint>) {
    result = this.subscribableMixin.finishRoutine(result);
    result = this.cacheableMixin.finishRoutine(result, false);
    return result;
  }

  protected invalidateRoutine() {
    this.subscribableMixin.invalidateRoutine();
    this.cacheableMixin.invalidateRoutine();
  }

  protected deleteRoutine() {
    this.fs._unsub(this);
    this.subscribableMixin.deleteRoutine();
    this.cacheableMixin.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating) {}

  responseEqual(a: bigint, b: bigint): boolean {
    return this.desc.recursive ? false : a === b;
  }
}
