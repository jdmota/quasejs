import fsextra from "fs-extra";
import { $EQUALS, $FORMAT, $HASHCODE, $SERIALIZE } from "../../util/values";
import { type TinyTask, tinyTask } from "../../util/fiber-tiny";
import { serializationRegistry } from "../utils/serialization-db";
import {
  type IncrementalCellOwnerDescription,
  IncrementalCellDescription,
} from "../descriptions/cells";
import type { IncrementalContextRuntime } from "../runtime/functions";
import { IncrementalCellRuntime } from "../runtime/cells";
import { IncrementalCellOwner } from "../runtime/cell-owners";
import { FileChange, IncrementalFS } from "./file-system";

// By decreasing this value when using it,
// we ensure we always invalidate the cells.
// Since it is negative,
// it will never be confused with actual timestamps.
let NO_TIMESTAMP: bigint = -1n;

export class IncrementalFileDescription implements IncrementalCellOwnerDescription {
  constructor(readonly path: string) {}

  [$EQUALS](other: unknown): boolean {
    return (
      other instanceof IncrementalFileDescription && this.path === other.path
    );
  }

  [$HASHCODE]() {
    return this.path.length;
  }

  getCacheKey() {
    return `File(${this.path}`;
  }

  [$FORMAT]() {
    return `File(${this.path})`;
  }

  [$SERIALIZE]() {
    return {
      name: "IncrementalFileDescription",
      version: 1,
      value: {
        path: this.path,
      },
    };
  }
}

serializationRegistry.registerDeserializer<
  { path: string },
  IncrementalFileDescription
>("IncrementalFileDescription", ({ value: { path } }) => {
  return new IncrementalFileDescription(path);
});

export class IncrementalFileEventDescription extends IncrementalCellDescription<bigint> {
  constructor(
    readonly path: string,
    readonly type: FileChange,
    readonly recursive: boolean
  ) {
    super(new IncrementalFileDescription(path));
  }

  [$EQUALS](other: unknown): boolean {
    return (
      other instanceof IncrementalFileEventDescription &&
      this.path === other.path &&
      this.type === other.type &&
      this.recursive === other.recursive
    );
  }

  [$HASHCODE]() {
    return this.path.length + 31 * this.type.length + (this.recursive ? 1 : 2);
  }

  getCacheKey() {
    return `FileEvent(${this.path},${this.type},${this.recursive})`;
  }

  [$FORMAT]() {
    return `FileEvent(${this.path},${this.type},${this.recursive})`;
  }

  [$SERIALIZE]() {
    return {
      name: "IncrementalFileEventDescription",
      version: 1,
      value: {
        path: this.path,
        type: this.type,
        recursive: this.recursive,
      } satisfies IncrementalFileEventDescriptionJSON,
    };
  }
}

type IncrementalFileEventDescriptionJSON = {
  readonly path: string;
  readonly type: FileChange;
  readonly recursive: boolean;
};

serializationRegistry.registerDeserializer<
  IncrementalFileEventDescriptionJSON,
  IncrementalFileEventDescription
>("IncrementalFileEventDescription", ({ value: { path, type, recursive } }) => {
  return new IncrementalFileEventDescription(path, type, recursive);
});

type FileCell = IncrementalCellRuntime<IncrementalFileEventDescription>;

function createFileCell(
  fs: IncrementalFS,
  file: IncrementalFile,
  path: string,
  type: FileChange,
  recursive: boolean
): FileCell {
  const cell = new IncrementalCellRuntime(
    fs.backend,
    file,
    new IncrementalFileEventDescription(path, type, recursive),
    file.isCacheable && !recursive
  );
  if (recursive) {
    cell.set(NO_TIMESTAMP--);
  }
  return cell;
}

async function getTimestamp(path: string) {
  const { birthtimeNs, mtimeNs } = await fsextra
    .stat(path, {
      bigint: true,
    })
    .catch(() => {
      NO_TIMESTAMP--;
      return {
        birthtimeNs: NO_TIMESTAMP,
        mtimeNs: NO_TIMESTAMP,
      };
    });
  return { birthtimeNs, mtimeNs };
}

export class IncrementalFile extends IncrementalCellOwner {
  private ready: Promise<unknown> | null = null;
  readonly mainCells: {
    [FileChange.ADD_REMOVE]: FileCell;
    [FileChange.CHANGE]: FileCell;
  };
  readonly recCells: {
    [FileChange.ADD_REMOVE]: FileCell;
    [FileChange.CHANGE]: FileCell;
  };
  public readonly isCacheable: boolean;
  private timestampJob: TinyTask<void> | null = null;
  private reload: boolean;

  constructor(
    private readonly fs: IncrementalFS,
    readonly path: string
  ) {
    super(fs.backend, new IncrementalFileDescription(path));
    this.isCacheable = fs.backend.db != null;
    this.reload = this.isCacheable;
    // Call "createFileCell" only after fields initialization
    this.mainCells = {
      ADD_REMOVE: createFileCell(fs, this, path, FileChange.ADD_REMOVE, false),
      CHANGE: createFileCell(fs, this, path, FileChange.CHANGE, false),
    };
    this.recCells = {
      ADD_REMOVE: createFileCell(fs, this, path, FileChange.ADD_REMOVE, true),
      CHANGE: createFileCell(fs, this, path, FileChange.CHANGE, true),
    };
  }

  inv(): void {}

  getCell<Desc extends IncrementalCellDescription<any>>(
    desc: Desc
  ): IncrementalCellRuntime<Desc> | undefined {
    if (desc instanceof IncrementalFileEventDescription) {
      return (desc.recursive ? this.recCells : this.mainCells)[
        desc.type
      ] satisfies FileCell as any;
    }
  }

  override onNeedChange(needed: boolean): void {}

  reactFile() {
    this.timestampJob?.abort();
    this.timestampJob = null;
    this.demand();
  }

  reactRecursive(type: FileChange) {
    this.recCells[type].set(NO_TIMESTAMP--);
  }

  depend(
    ctx: IncrementalContextRuntime<any, any, any>,
    change: FileChange,
    recursive: boolean
  ) {
    return ctx._read((recursive ? this.recCells : this.mainCells)[change]);
  }

  demandAndWait(): Promise<void> {
    if (!this.timestampJob) {
      this.timestampJob = tinyTask(async ctx => {
        if (this.fs.backend.invalidationsAllowed()) {
          this.ready ||= this.fs.ensureWatcher().addPromise(this.path);
          await this.ready;
        }
        if (ctx.active) {
          let cachedAddRemove, cachedChange;
          if (this.reload) {
            this.reload = false;
            cachedAddRemove = this.fs.backend.db!.getCell(
              this.mainCells[FileChange.ADD_REMOVE].desc
            );
            cachedChange = this.fs.backend.db!.getCell(
              this.mainCells[FileChange.CHANGE].desc
            );
          }
          const { birthtimeNs, mtimeNs } = await getTimestamp(this.path);
          if (ctx.active) {
            const usedAddRemoveCache = this.mainCells[
              FileChange.ADD_REMOVE
            ]._reload(cachedAddRemove, birthtimeNs);
            const usedChangeCache = this.mainCells[FileChange.CHANGE]._reload(
              cachedChange,
              mtimeNs
            );

            if (this.isCacheable) {
              if (!usedAddRemoveCache) {
                this.mainCells[FileChange.ADD_REMOVE]._cacheCell();
              }
              if (!usedChangeCache) {
                this.mainCells[FileChange.CHANGE]._cacheCell();
              }
            }
          }
        }
      });
    }
    return this.timestampJob.promise;
  }

  delete() {
    const watcher = this.fs.getCurrentWatcher();
    this.ready = null;
    this.fs._deleteFile(this);
    if (watcher) {
      watcher.unwatch(this.path);
    }
    if (this.isCacheable) {
      this.mainCells[FileChange.ADD_REMOVE]._uncacheCell();
      this.mainCells[FileChange.CHANGE]._uncacheCell();
    }
    this.fs.logger.debug("Deleted", this.path);
  }
}
