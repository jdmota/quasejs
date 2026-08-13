import { type IncrementalBackend } from "./backend";
import {
  type IncrementalCellOwnerDescription,
  IncrementalCellDescription,
} from "../descriptions/cells";
import type { IncrementalCellRuntime } from "./cells";

export const PREV_CELL_OWNER = Symbol("quase.incremental.prev.cell_owner");
export const NEXT_CELL_OWNER = Symbol("quase.incremental.next.cell_owner");

export abstract class IncrementalCellOwner {
  private root = false;
  protected subsCount = 0;

  [PREV_CELL_OWNER]: IncrementalCellOwner | null = null;
  [NEXT_CELL_OWNER]: IncrementalCellOwner | null = null;

  constructor(
    readonly backend: IncrementalBackend<any>,
    readonly desc0: IncrementalCellOwnerDescription
  ) {
    this.backend.markNeed(this, this.isNeeded(), true);
  }

  abstract inv(): void;
  abstract getCell<Desc extends IncrementalCellDescription<any>>(
    desc: Desc
  ): IncrementalCellRuntime<Desc> | undefined;
  abstract demandAndWait(): Promise<void>;
  abstract onNeedChange(needed: boolean): void;
  abstract delete(): void;

  isOrphan(): boolean {
    return this.subsCount === 0;
  }

  onSubscribed(cell: IncrementalCellRuntime<any>) {
    this.subsCount++;
    if (this.subsCount === 1) {
      this.backend.markNeed(this, true);
      this.onNeedChange(true);
    }
  }

  onUnsubscribed(cell: IncrementalCellRuntime<any>) {
    this.subsCount--;
    if (this.subsCount === 0 && !this.root) {
      this.backend.markNeed(this, false);
      this.onNeedChange(false);
    }
  }

  markRoot(root: boolean) {
    if (this.root !== root) {
      this.root = root;
      if (this.subsCount === 0) {
        this.backend.markNeed(this, this.root);
        this.onNeedChange(this.root);
      }
    }
    return this;
  }

  isRoot() {
    return this.root;
  }

  isNeeded() {
    return !this.isOrphan() || this.isRoot();
  }

  demand() {
    this.demandAndWait();
  }
}
