import { $EQUALS, $FORMAT, $HASHCODE, $SERIALIZE } from "../../../util/values";
import { HashMap } from "../../utils/hash-map";
import { serializationRegistry } from "../../utils/serialization-db";
import {
  type IncrementalCellOwnerDescription,
  IncrementalCellDescription,
} from "../descriptions/cells";
import type { IncrementalBackend } from "./backend";
import { IncrementalCellOwner, IncrementalCellRuntime } from "./cells";

export class IncrementalRootDescription
  implements IncrementalCellOwnerDescription
{
  constructor(readonly name: string) {}

  [$EQUALS](other: unknown): boolean {
    return (
      other instanceof IncrementalRootDescription && other.name === this.name
    );
  }

  [$HASHCODE](): number {
    return this.name.length;
  }

  getCacheKey(): string {
    return `Root{${this.name}}`;
  }

  [$FORMAT](): string {
    return `Root{${this.name}}`;
  }

  [$SERIALIZE]() {
    return {
      name: "IncrementalRootDescription",
      version: 1,
      value: {
        name: this.name,
      },
    };
  }
}

serializationRegistry.registerDeserializer<
  { name: string },
  IncrementalRootDescription
>("IncrementalRootDescription", ({ value }) => {
  return new IncrementalRootDescription(value.name);
});

export class IncrementalRoot extends IncrementalCellOwner {
  private readonly cells: HashMap<
    IncrementalCellDescription<any>,
    IncrementalCellRuntime<any>
  >;

  constructor(
    backend: IncrementalBackend,
    readonly name: string
  ) {
    super(backend, new IncrementalRootDescription(name));
    this.cells = new HashMap({
      equal: (a, b) => a[$EQUALS](b),
      hash: a => a[$HASHCODE](),
    });
  }

  inv(): void {}

  getCell<Desc extends IncrementalCellDescription<any>>(
    desc: Desc
  ): IncrementalCellRuntime<Desc> | undefined {
    return this.cells.get(desc);
  }

  ensureCell<Desc extends IncrementalCellDescription<any>>(
    desc: Desc
  ): IncrementalCellRuntime<Desc> {
    return this.cells.computeIfAbsent(
      desc,
      () => new IncrementalCellRuntime(this.backend, this, desc)
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
