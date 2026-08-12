import { computeIfAbsent } from "../../util/maps-sets";
import { $EQUALS, $FORMAT, $HASHCODE, $SERIALIZE } from "../../util/values";
import { serializationRegistry } from "../utils/serialization-db";
import {
  type IncrementalCellOwnerDescription,
  IncrementalAllocatedCellDescription,
  IncrementalCellDescription,
} from "../descriptions/cells";
import type { CellsTypes } from "../descriptions/functions";
import type { IncrementalBackend } from "./backend";
import { IncrementalCellOwner, IncrementalCellRuntime } from "./cells";

export class IncrementalRootDescription
  implements IncrementalCellOwnerDescription
{
  [$EQUALS](other: unknown): boolean {
    return other instanceof IncrementalRootDescription;
  }

  [$HASHCODE](): number {
    return 0;
  }

  getCacheKey(): string {
    return `Root`;
  }

  [$FORMAT](): string {
    return `Root`;
  }

  [$SERIALIZE]() {
    return {
      name: "IncrementalRootDescription",
      version: 1,
      value: null,
    };
  }
}

serializationRegistry.registerDeserializer<
  { name: string },
  IncrementalRootDescription
>("IncrementalRootDescription", () => {
  return new IncrementalRootDescription();
});

export class IncrementalRootAPI<Cells extends CellsTypes> {
  constructor(private _root: IncrementalRoot<Cells>) {}

  get<K extends string & keyof Cells>(key: K) {
    const cell = this._root.alloc(key);
    return {
      set(value: Cells[K]) {
        cell.set(value);
      },
    };
  }
}

export class IncrementalRoot<
  Cells extends CellsTypes,
> extends IncrementalCellOwner {
  private readonly cells: Map<
    string,
    IncrementalCellRuntime<IncrementalAllocatedCellDescription<any>>
  >;
  public readonly publicApi: IncrementalRootAPI<Cells>;

  constructor(backend: IncrementalBackend<Cells>) {
    super(backend, new IncrementalRootDescription());
    this.cells = new Map();
    this.publicApi = new IncrementalRootAPI(this);
  }

  inv(): void {}

  getCell<Desc extends IncrementalCellDescription<any>>(
    desc: Desc
  ): IncrementalCellRuntime<Desc> | undefined {
    if (
      desc instanceof IncrementalAllocatedCellDescription &&
      desc.owner[$EQUALS](this.desc0)
    ) {
      return this.cells.get(desc.key) as any;
    }
  }

  alloc<K extends string & keyof Cells>(
    key: K
  ): IncrementalCellRuntime<IncrementalAllocatedCellDescription<Cells[K]>> {
    return computeIfAbsent(
      this.cells,
      key,
      () =>
        new IncrementalCellRuntime(
          this.backend,
          this,
          new IncrementalAllocatedCellDescription(this.desc0, key, 0)
        )
    );
  }

  demandAndWait(): Promise<void> {
    return Promise.resolve();
  }

  override isRoot(): boolean {
    return true;
  }

  delete() {
    // Do nothing
  }

  override isOrphan(): boolean {
    return false;
  }

  override onSubscribed(cell: IncrementalCellRuntime<any>): void {
    // Do nothing because this will always be a root
  }

  override onUnsubscribed(cell: IncrementalCellRuntime<any>): void {
    // Do nothing because this will always be a root
  }
}
