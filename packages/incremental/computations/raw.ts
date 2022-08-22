import { Result, error } from "../utils/result";
import {
  ComputationRegistry,
  ComputationDescription,
} from "../incremental-lib";
import { joinIterators } from "../utils/join-iterators";

export enum State {
  PENDING = 0,
  RUNNING = 1,
  ERRORED = 2,
  DONE = 3,
  DELETED = 4,
  CREATING = 5,
}

export type StateNotCreating =
  | State.PENDING
  | State.RUNNING
  | State.ERRORED
  | State.DONE
  | State.DELETED;

export type StateNotDeleted =
  | State.PENDING
  | State.RUNNING
  | State.ERRORED
  | State.DONE
  | State.CREATING;

export type RunId = {
  readonly __opaque__: unique symbol;
};

function newRunId() {
  return {} as RunId;
}

type ReachabilityId = {
  readonly __opaque__: unique symbol;
};

function newReachabilityId(): ReachabilityId {
  return {} as ReachabilityId;
}

type ReachabilityStatus = {
  pending: boolean;
  id: ReachabilityId | null;
};

enum Reachability {
  UNCONNECTED = 0,
  CONNECTED = 1,
  // UNKNOWN = 2,
}

export type AnyRawComputation = RawComputation<any, any>;

export abstract class RawComputation<Ctx, Res> {
  public readonly registry: ComputationRegistry;
  public readonly description: ComputationDescription<any>;
  // Current state
  private state: State;
  private runId: RunId | null;
  private running: Promise<Result<Res>> | null;
  // Latest result
  protected result: Result<Res> | null;
  // Requirements of SpecialQueue
  public prev: AnyRawComputation | null;
  public next: AnyRawComputation | null;
  // Reachability
  private reachable: boolean;
  private readonly reachabilityStatus: ReachabilityStatus;

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    mark: boolean = true
  ) {
    this.registry = registry;
    this.description = description;
    this.state = State.CREATING;
    this.runId = null;
    this.running = null;
    this.result = null;
    this.prev = null;
    this.next = null;
    this.reachable = false;
    this.reachabilityStatus = {
      pending: false,
      id: null,
    };
    if (mark) this.mark(State.PENDING);
  }

  peekError() {
    if (this.result?.ok === false) {
      return this.result.error;
    }
    throw new Error("Assertion error: no error");
  }

  protected abstract exec(ctx: Ctx): Promise<Result<Res>>;
  protected abstract makeContext(runId: RunId): Ctx;
  protected abstract isOrphan(): boolean;
  protected abstract onReachabilityChange(
    state: State,
    from: boolean,
    to: boolean
  ): void;
  protected abstract onStateChange(
    from: StateNotDeleted,
    to: StateNotCreating
  ): void;
  protected abstract finishRoutine(result: Result<Res>): void;
  protected abstract invalidateRoutine(): void;
  protected abstract deleteRoutine(): void;

  isRoot(): boolean {
    return false;
  }

  isReachable(): boolean {
    return this.reachable || this.isRoot();
  }

  onInEdgeAddition(node: AnyRawComputation) {
    // Remove from delayed removal
    this.delayedRemovedInNodes.delete(node);
    node.delayedRemovedOutNodes.delete(this);
    //
    if (node.isReachable()) {
      // Mark this and all reachable nodes as reachable
      this.markReachable(null);
    }
  }

  // When invalidations occur, some edges are removed.
  // After the computation reruns,
  // it is probable that the same edges are restored.
  // So we delay edge removals until the computation settles.
  // (See mark function)
  private delayedRemovedInNodes = new Set<AnyRawComputation>();
  private delayedRemovedOutNodes = new Set<AnyRawComputation>();

  onInEdgeRemoval(node: AnyRawComputation) {
    // Delay removal of edges
    // (Note: only if this node is a child and a subscribable computation can there be repeated in-nodes. Even if that is the case, this is fine.)
    this.delayedRemovedInNodes.add(node);
    node.delayedRemovedOutNodes.add(this);
  }

  private removeScheduledEdges() {
    const outNodes = Array.from(this.delayedRemovedOutNodes);
    this.delayedRemovedOutNodes.clear();
    for (const outNode of outNodes) {
      outNode.delayedRemovedInNodes.delete(this);
    }
    // While all these checkReachability calls are running,
    // there are no reentrant calls that modify edges.
    // Additionally, we cannot trust any this.reachable field
    // unless it was updated in this session.
    // When this function call (removeScheduledEdges) finishes,
    // all reachable values are updated.
    const id = newReachabilityId();
    for (const outNode of outNodes) {
      outNode.checkReachability(id);
    }
  }

  // TODO extract this to a mixin, since we do not need this to be that complicated for general computations where cycles are not even allowed
  // TODO somehow, avoid too deep recursive calls
  // TODO another issue is that we might go up, to find out that something is now reachable
  // which then will walk down marking everything as reachable, this way
  // we might traverse edges more than once...
  // TODO another issue is that we should be able to batch edge removals...
  // TODO use strong connected components?
  // IF the removed edge was inside the component, see if we need to split the component.
  // AND do nothing else?????
  // IF the removed edge goes from one component to another, we just need to check the parent components to find one that is reachable, in other words, we ignore all the nodes in the same component (the ones that form a cycle)

  private checkReachability(id: ReachabilityId): boolean {
    // Roots are trivially reachable
    if (this.isRoot()) {
      return true;
    }
    // If the id is the same, we already have seen this node in this session
    if (this.reachabilityStatus.id === id) {
      // If pending, it means we are still computing this node's
      // reachability and we hit a cycle. Return false.
      // Otherwise, we can trust that this.reachable is updated.
      return this.reachabilityStatus.pending ? false : this.reachable;
    }
    this.reachabilityStatus.id = id;
    this.reachabilityStatus.pending = true;
    // Check if this node is still reachable (by finding a root)
    for (const inNode of this.inNodes()) {
      if (inNode.checkReachability(id)) {
        this.markReachable(id);
        return true;
      }
    }
    // This node is not reachable
    this.markUnreachable(id);
    return false;
  }

  private markReachable(id: ReachabilityId | null) {
    this.reachabilityStatus.pending = false;
    this.reachabilityStatus.id = id;
    if (this.isReachable()) {
      // If it was already reachable that is fine.
      // Even if this value was not set in this session,
      // it means that it was reachable before,
      // which means that all out-nodes were reachable before as well,
      // implying that their this.reachable value does not need to be updated.
      return;
    }
    this.reachable = true;
    this.onReachabilityChange(this.state, false, true);
    for (const child of this.outNodes()) {
      child.markReachable(id);
    }
  }

  private markUnreachable(id: ReachabilityId) {
    this.reachabilityStatus.pending = false;
    this.reachabilityStatus.id = id;
    if (!this.isReachable()) {
      // If it was already not-reachable that is fine.
      // Even if this value was not set in this session,
      // it means that it was not-reachable before.
      // So, no out-node needs to be rechecked
      // because of this node (but maybe because of other nodes).
      return;
    }
    this.reachable = false;
    this.onReachabilityChange(this.state, true, false);
    // This node is no longer reachable,
    // check all out-nodes to see if they are still reachable
    for (const outNode of this.outNodes()) {
      outNode.checkReachability(id);
    }
  }

  protected abstract inNodesRoutine(): IterableIterator<AnyRawComputation>;
  protected abstract outNodesRoutine(): IterableIterator<AnyRawComputation>;

  inNodes() {
    return joinIterators(
      this.inNodesRoutine(),
      this.delayedRemovedInNodes.values()
    );
  }

  outNodes() {
    return joinIterators(
      this.outNodesRoutine(),
      this.delayedRemovedOutNodes.values()
    );
  }

  protected deleted() {
    return this.state === State.DELETED;
  }

  inv() {
    if (this.deleted()) {
      throw new Error("Unexpected deleted computation");
    }
  }

  active(runId: RunId) {
    if (runId !== this.runId) {
      throw new Error("Computation was cancelled");
    }
  }

  async run(): Promise<Result<Res>> {
    this.inv();
    if (!this.running) {
      const { exec } = this;
      const runId = newRunId();
      this.runId = runId;
      this.running = exec(this.makeContext(runId)).then(
        v => this.finish(v, runId),
        e => this.finish(error(e), runId)
      );
      this.mark(State.RUNNING);
    }
    return this.running;
  }

  private finish(result: Result<Res>, runId: RunId): Result<Res> {
    if (this.runId === runId) {
      this.result = result;
      this.finishRoutine(result);
      this.removeScheduledEdges();
      this.mark(result.ok ? State.DONE : State.ERRORED);
    }
    return result;
  }

  invalidate() {
    this.inv();
    this.runId = null;
    this.running = null;
    this.result = null;
    this.invalidateRoutine();
    this.mark(State.PENDING);
  }

  // pre: !this.isReachable()
  destroy() {
    this.inv();
    this.runId = null;
    this.running = null;
    this.result = null;
    this.deleteRoutine();
    this.removeScheduledEdges();
    this.mark(State.DELETED);
  }

  protected mark(state: StateNotCreating) {
    const prevState = this.state;
    if (prevState === State.DELETED) {
      throw new Error("Unexpected deleted computation");
    }
    if (prevState !== State.CREATING) {
      this.registry.computations[prevState].delete(this);
    }
    if (state === State.DELETED) {
      this.registry.delete(this);
    } else {
      this.registry.computations[state].add(this);
    }
    this.state = state;
    this.onStateChange(prevState, state);
  }

  maybeRun() {
    if (this.isReachable()) {
      this.run();
    }
  }
}
