// The implementation of a incremental reachability algorithm
// which I now realize is like the "Simple Incremental" algorithm
// which mantains a reachability tree rooted at some source
// https://arxiv.org/pdf/1905.01216
import { CounterMap } from "../../util/data-structures/counter-map";
import { LinkedList } from "../../util/data-structures/linked-list";

type ReachabilityId = number & {
  readonly __opaque__: unique symbol;
};

let reachabilityUuid = 1;

export interface ReachableNode {
  onReachabilityChange(from: boolean, to: boolean): void;
}

type Recheck = {
  readonly queue: LinkedList<ReachableMixin>;
  readonly id: ReachabilityId;
};

export class ReachableMixin {
  public readonly node: ReachableNode;
  // Reachability
  // By keeping track of one edge that leads to the root,
  // we reduce the chances that we need to recheck each node,
  // since most likely, the edge removed, is not this one.
  private reachable: ReachableMixin | null;
  // If reachable != null, this information tells us if we can trust such value
  // reachabilityStatusId says in which session reachability was checked
  // reachabilityStatusConfirmed says if the check is done
  private reachabilityStatusId: ReachabilityId | null;
  private reachabilityStatusConfirmed: boolean;
  // Node -> number of edges associated with the same node
  private readonly inNodes = new CounterMap<ReachableMixin>();
  private readonly outNodes = new CounterMap<ReachableMixin>();
  // We delay edge removals until things settle
  // (See mark function)
  private readonly delayedRemovedOutNodes = new CounterMap<ReachableMixin>();

  // To implement nodes those "root" status changes,
  // it is easier (and less error prone),
  // to actually have a single "root" for the purposes of reachability
  // and then connect that "root" to other nodes that
  // are to be considered "roots" at the application level

  constructor(
    source: ReachableNode,
    private readonly root: boolean
  ) {
    this.node = source;
    this.reachable = null;
    this.reachabilityStatusId = null;
    this.reachabilityStatusConfirmed = false;
  }

  isRoot(): boolean {
    return this.root;
  }

  isReachable(): boolean {
    return this.reachable != null || this.isRoot();
  }

  onInEdgeAddition(node: ReachableMixin) {
    // Add edge
    if (node.delayedRemovedOutNodes.has(this)) {
      node.delayedRemovedOutNodes.dec(this);
    } else {
      this.inNodes.inc(node);
      node.outNodes.inc(this);
    }
    if (node.isReachable()) {
      // Mark this and all reachable nodes as reachable
      this.markReachable(node);
    }
  }

  onInEdgeRemoval(node: ReachableMixin) {
    // Delay removal of edge
    node.delayedRemovedOutNodes.inc(this);
  }

  private markReachable(from: ReachableMixin) {
    if (this.isReachable()) {
      // If this node is already reachable,
      // the children already are as well
      return;
    }
    this.reachable = from;
    this.node.onReachabilityChange(false, true);
    for (const child of this.outNodes) {
      child.markReachable(this);
    }
  }

  static prepareRecheck(): Recheck {
    return {
      queue: new LinkedList<ReachableMixin>(),
      id: reachabilityUuid++ as ReachabilityId,
    };
  }

  performDeletionsAndRecheck({ queue, id }: Recheck) {
    for (const [outNode, count] of this.delayedRemovedOutNodes.entries()) {
      // Perform the edge removals
      const c = outNode.inNodes.minus(this, count);
      this.outNodes.minus(outNode, count);
      // Schedule for recheck if needed
      if (outNode.reachable === this && c === 0) {
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
    // When this function call finishes,
    // all reachable values are updated.
    // The queue will contain all the nodes for which
    // this.reachable was the edge removed.
    // If this.reachable was already null, no need to add the node to the queue.
    for (const node of queue.iterateAndRemove()) {
      node.checkReachability(queue, id);
    }
  }

  private checkReachability(
    queue: LinkedList<ReachableMixin>,
    id: ReachabilityId
  ): boolean {
    // Roots are trivially reachable
    if (this.isRoot()) {
      return true;
    }
    // Since this routine was started to react to edge removals:
    // If this node was not reachable before, it remains unreachable
    // If this node became unreachable now,
    // then the procedure to recheck out-nodes was already executed.
    // In both cases, we can return here.
    if (this.reachable == null) {
      return false;
    }
    // If the id is the same, we already have seen this node in this session
    if (this.reachabilityStatusId === id) {
      // If confirmed is false, it means we are still computing this node's
      // reachability and we hit a cycle. Return false.
      // Otherwise, we can trust that this.reachable != null was confirmed.
      return this.reachabilityStatusConfirmed;
    }
    // First time seeing this node in this session...
    this.reachabilityStatusId = id;
    this.reachabilityStatusConfirmed = false;
    // Check if this node is still reachable (by finding a root)
    for (const inNode of this.inNodes) {
      if (inNode.checkReachability(queue, id)) {
        // Since this routine was started to react to edge removals,
        // if this node is reachable now, it was reachable before
        // No need to check the children
        // If their this.reachable was removed or is no longer reachable,
        // they will be added to the queue anyway.
        this.reachabilityStatusConfirmed = true;
        // Set this.reachable to a node we are sure will lead to the root
        this.reachable = inNode;
        return true;
      }
    }
    // This node is no longer reachable
    this.reachable = null;
    this.node.onReachabilityChange(true, false);
    for (const outNode of this.outNodes) {
      if (outNode.reachable === this) {
        // If this outNode was reachable through this node
        // We need to recheck its reachability
        queue.addLast(outNode);
      }
    }
    return false;
  }
}

// One alternative solution would be to use strong connected components instead of nodes.
// If the removed edge were inside a component, split the component.
// All nodes in the previous component should still be reachable from the root.
// If the removed edge goes from one component to another,
// we just need to check if we have a reachable parent component,
// because the cycles only exist inside the components.
// The summary is that we should ignore the edges that lead to itself (i.e. a cycle).
// But keeping track of the strong components, or even just the cycles,
// is probably more complicated than what we have here.
// In fact, if we use this to track needed computations (from the roots),
// on that use case, we already should not have cycles.
