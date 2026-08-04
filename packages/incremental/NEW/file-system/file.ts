import fsextra from "fs-extra";
import { type TinyTask, tinyTask } from "../../../util/fiber-tiny";
import { serializationDB } from "../../utils/serialization-db";
import { valueDesc } from "../descriptions/values";
import { IncrementalCellDescription } from "../descriptions/cells";
import type { IncrementalContextRuntime } from "../runtime/functions";
import { IncrementalCellRuntime } from "../runtime/cells";
import { FileChange, FileSystem, FileSystemDescription } from "./file-system";

const NO_TIMESTAMP: bigint = -1n;

const timestampValDef = valueDesc<bigint, any>(
  (a, b) => (a < 0 || b < 0 ? false : a === b),
  val => 0,
  val => val,
  val => val,
  val => val + ""
);

export class IncrementalFileDescription extends IncrementalCellDescription<bigint> {
  constructor(
    readonly path: string,
    readonly type: FileChange,
    readonly recursive: boolean
  ) {
    super(FileSystemDescription.SINGLETON);
  }

  equal(other: unknown): boolean {
    return (
      other instanceof IncrementalFileDescription &&
      this.path === other.path &&
      this.type === other.type &&
      this.recursive === other.recursive
    );
  }

  hash() {
    return this.path.length + 31 * this.type.length + (this.recursive ? 1 : 2);
  }

  getCacheKey() {
    return `File(${this.path},${this.type},${this.recursive})`;
  }

  format() {
    return `File(${this.path},${this.type},${this.recursive})`;
  }
}

type IncrementalFileDescriptionJSON = {
  readonly path: string;
  readonly type: FileChange;
  readonly recursive: boolean;
};

serializationDB.register<
  IncrementalFileDescription,
  IncrementalFileDescriptionJSON
>(IncrementalFileDescription, {
  name: "IncrementalFileDescription",
  serialize: value => {
    return {
      path: value.path,
      type: value.type,
      recursive: value.recursive,
    };
  },
  deserialize: ({ path, type, recursive }) => {
    return new IncrementalFileDescription(path, type, recursive);
  },
});

type FileCell = IncrementalCellRuntime<IncrementalFileDescription>;

function createFileCell(
  fs: FileSystem,
  path: string,
  type: FileChange,
  recursive: boolean,
  onUnsub: () => void
): FileCell {
  const cell = new IncrementalCellRuntime(
    fs.backend,
    fs,
    new IncrementalFileDescription(path, type, recursive),
    timestampValDef
  );
  cell._onUnsub = onUnsub;
  if (recursive) {
    cell.set(NO_TIMESTAMP);
  }
  return cell;
}

async function getTimestamp(path: string) {
  const { birthtimeNs, mtimeNs } = await fsextra
    .stat(path, {
      bigint: true,
    })
    .catch(() => ({
      birthtimeNs: NO_TIMESTAMP,
      mtimeNs: NO_TIMESTAMP,
    }));
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
    private readonly fs: FileSystem,
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
    this.recCells[type].set(NO_TIMESTAMP);
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
              this.fs.backend.db!.saveCell(
                this.mainCells[FileChange.ADD_REMOVE]
              );
              this.fs.backend.db!.saveCell(this.mainCells[FileChange.CHANGE]);
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
        this.fs.backend.db!.unsaveCell(this.mainCells[FileChange.ADD_REMOVE]);
        this.fs.backend.db!.unsaveCell(this.mainCells[FileChange.CHANGE]);
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
