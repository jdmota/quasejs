import { Result, error } from "../utils/result";
import {
  ComputationRegistry,
  ComputationDescription,
} from "../incremental-lib";
import { joinIterators } from "../utils/join-iterators";
import { LinkedList } from "../utils/linked-list";

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
  confirmed: boolean;
  id: ReachabilityId | null;
};

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
    this.reachable = null;
    this.reachabilityStatus = {
      confirmed: false,
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
    return this.reachable != null || this.isRoot();
  }

  onInEdgeAddition(node: AnyRawComputation) {
    // Remove from delayed removal
    this.delayedRemovedInNodes.delete(node);
    node.delayedRemovedOutNodes.delete(this);
    //
    if (node.isReachable()) {
      // Mark this and all reachable nodes as reachable
      this.markReachable(node);
    }
  }

  // TODO when marking as reachable, use breath first to only leave the edges that lead to shortest paths activated
  private markReachable(from: AnyRawComputation) {
    if (this.isReachable()) {
      // If this node is already reachable,
      // the children already are as well
      return;
    }
    this.reachable = from;
    this.onReachabilityChange(this.state, false, true);
    for (const child of this.outNodes()) {
      child.markReachable(this);
    }
  }

  // Reachability
  // By keeping track of one edge that leads to the root,
  // we reduce the changes that we need to recheck each node,
  // since most likely, the edge removed, is not this one.
  private reachable: AnyRawComputation | null;
  private readonly reachabilityStatus: ReachabilityStatus;
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
    const queue = new LinkedList<AnyRawComputation>();
    // Perform the edge removals
    for (const outNode of this.delayedRemovedOutNodes) {
      outNode.delayedRemovedInNodes.delete(this);
      if (outNode.reachable === this) {
        // If this outNode was reachable through this node
        // We need to recheck its reachability
        queue.addLast(outNode);
      }
    }
    this.delayedRemovedOutNodes.clear();

    // While all these checkReachability calls are running,
    // there are no reentrant calls that modify edges.
    // But we cannot trust any this.reachable != null fields
    // unless they were confirmed in this session.
    // When this function call (removeScheduledEdges) finishes,
    // all reachable values are updated.
    // The queue will contain all the nodes for which
    // this.reachable was the edge removed.
    // If this.reachable was already null, no need to add the node to the queue.
    const id = newReachabilityId();
    for (const node of queue.iterateAndRemove()) {
      node.checkReachability(queue, id);
    }
  }

  // TODO extract this to a mixin, since we do not need this to be that complicated for general computations where cycles are not even allowed
  // TODO another issue is that we should be able to batch edge removals...
  // TODO use strong connected components?
  // IF the removed edge was inside the component, see if we need to split the component.
  // AND do nothing else?????
  // IF the removed edge goes from one component to another, we just need to check the parent components to find one that is reachable, in other words, we ignore all the nodes in the same component (the ones that form a cycle)
  // TODO the idea is "simple": ignore the in edges that are also reached by the relevant node

  private checkReachability(
    queue: LinkedList<AnyRawComputation>,
    id: ReachabilityId
  ): boolean {
    // Roots are trivially reachable
    if (this.isRoot()) {
      return true;
    }
    // Since this routine was started to react to edge removals:
    // If this node was not reachable before, it remains unreachable
    // If this node became unreachable now, the procedure to recheck out-nodes
    // was already executed.
    // In any case, we can return here.
    if (this.reachable == null) {
      return false;
    }
    // If the id is the same, we already have seen this node in this session
    if (this.reachabilityStatus.id === id) {
      // If confirmed is false, it means we are still computing this node's
      // reachability and we hit a cycle. Return false.
      // Otherwise, we can trust that this.reachable != null was confirmed.
      return this.reachabilityStatus.confirmed;
    }
    // First time seeing this node...
    this.reachabilityStatus.id = id;
    this.reachabilityStatus.confirmed = false;
    // Check if this node is still reachable (by finding a root)
    for (const inNode of this.inNodes()) {
      if (inNode.checkReachability(queue, id)) {
        // Since this routine was started to react to edge removals
        // If this node is reachable now, it was reachable before
        // No need to check the children
        // If their this.reachable was removed or is no longer reachable,
        // they will be added to the queue anyway.
        this.reachabilityStatus.confirmed = true;
        // Set this.reachable to a node we are sure will lead to the root
        this.reachable = inNode;
        return true;
      }
    }
    // This node is no longer reachable
    this.reachabilityStatus.id = null;
    this.reachable = null;
    this.onReachabilityChange(this.state, true, false);
    for (const outNode of this.outNodes()) {
      if (outNode.reachable === this) {
        // If this outNode was reachable through this node
        // We need to recheck its reachability
        queue.addLast(outNode);
      }
    }
    return false;
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
