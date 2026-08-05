import fsextra from "fs-extra";
import { $EQUALS, $FORMAT, $HASHCODE, $SERIALIZE } from "../../../util/values";
import { type TinyTask, tinyTask } from "../../../util/fiber-tiny";
import { serializationRegistry } from "../../utils/serialization-db";
import { IncrementalCellDescription } from "../descriptions/cells";
import type { IncrementalContextRuntime } from "../runtime/functions";
import { IncrementalCellRuntime } from "../runtime/cells";
import {
  FileChange,
  IncrementalFS,
  IncrementalFSDescription,
} from "./file-system";

// By allows decreasing this value when using it,
// we ensure we always invalid the cells.
// Since it is negative,
// it will never be confused with actual timestamps.
let NO_TIMESTAMP: bigint = -1n;

export class IncrementalFileDescription extends IncrementalCellDescription<bigint> {
  constructor(
    readonly path: string,
    readonly type: FileChange,
    readonly recursive: boolean
  ) {
    super(IncrementalFSDescription.SINGLETON);
  }

  [$EQUALS](other: unknown): boolean {
    return (
      other instanceof IncrementalFileDescription &&
      this.path === other.path &&
      this.type === other.type &&
      this.recursive === other.recursive
    );
  }

  [$HASHCODE]() {
    return this.path.length + 31 * this.type.length + (this.recursive ? 1 : 2);
  }

  getCacheKey() {
    return `File(${this.path},${this.type},${this.recursive})`;
  }

  [$FORMAT]() {
    return `File(${this.path},${this.type},${this.recursive})`;
  }

  [$SERIALIZE]() {
    return {
      name: "IncrementalFileDescription",
      version: 1,
      value: {
        path: this.path,
        type: this.type,
        recursive: this.recursive,
      } satisfies IncrementalFileDescriptionJSON,
    };
  }
}

type IncrementalFileDescriptionJSON = {
  readonly path: string;
  readonly type: FileChange;
  readonly recursive: boolean;
};

serializationRegistry.registerDeserializer<
  IncrementalFileDescriptionJSON,
  IncrementalFileDescription
>("IncrementalFileDescription", ({ value: { path, type, recursive } }) => {
  return new IncrementalFileDescription(path, type, recursive);
});

type FileCell = IncrementalCellRuntime<IncrementalFileDescription>;

function createFileCell(
  fs: IncrementalFS,
  path: string,
  type: FileChange,
  recursive: boolean,
  onUnsub: () => void
): FileCell {
  const cell = new IncrementalCellRuntime(
    fs.backend,
    fs,
    new IncrementalFileDescription(path, type, recursive)
  );
  cell._onUnsub = onUnsub;
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

export class FileInfo {
  private ready: Promise<unknown> | null = null;
  readonly mainCells: {
    [FileChange.ADD_REMOVE]: FileCell;
    [FileChange.CHANGE]: FileCell;
  };
  readonly recCells: {
    [FileChange.ADD_REMOVE]: FileCell;
    [FileChange.CHANGE]: FileCell;
  };
  private timestampJob: TinyTask<void> | null = null;
  private readonly isCacheable: boolean;
  private reload: boolean;

  constructor(
    private readonly fs: IncrementalFS,
    readonly path: string
  ) {
    const onUnsubCell = () => {
      if (this.subsCount() === 0) {
        fs.markUnreachable(this);
      }
    };
    this.mainCells = {
      ADD_REMOVE: createFileCell(
        fs,
        path,
        FileChange.ADD_REMOVE,
        false,
        onUnsubCell
      ),
      CHANGE: createFileCell(fs, path, FileChange.CHANGE, false, onUnsubCell),
    };
    this.recCells = {
      ADD_REMOVE: createFileCell(
        fs,
        path,
        FileChange.ADD_REMOVE,
        true,
        onUnsubCell
      ),
      CHANGE: createFileCell(fs, path, FileChange.CHANGE, true, onUnsubCell),
    };
    this.isCacheable = fs.backend.db != null;
    this.reload = this.isCacheable;
  }

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

  demand() {
    if (!this.timestampJob) {
      this.fs.markReachable(this);
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
            this.mainCells[FileChange.ADD_REMOVE]._reload(
              cachedAddRemove,
              birthtimeNs
            );
            this.mainCells[FileChange.CHANGE]._reload(cachedChange, mtimeNs);

            if (this.isCacheable) {
              this.mainCells[FileChange.ADD_REMOVE]._cacheCell(
                this.fs.backend.db!
              );
              this.mainCells[FileChange.CHANGE]._cacheCell(this.fs.backend.db!);
            }
          }
        }
      });
    }
  }

  delete() {
    if (this.subsCount() === 0) {
      const watcher = this.fs.getCurrentWatcher();
      this.ready = null;
      if (watcher) {
        watcher.unwatch(this.path);
      }
      if (this.isCacheable) {
        this.mainCells[FileChange.ADD_REMOVE]._uncacheCell(this.fs.backend.db!);
        this.mainCells[FileChange.CHANGE]._uncacheCell(this.fs.backend.db!);
      }
      this.fs.logger.debug("Deleted", this.path);
      return true;
    }
    return false;
  }

  subsCount() {
    return (
      this.mainCells.ADD_REMOVE.readersCount() +
      this.recCells.ADD_REMOVE.readersCount() +
      this.mainCells.CHANGE.readersCount() +
      this.recCells.CHANGE.readersCount()
    );
  }
}
