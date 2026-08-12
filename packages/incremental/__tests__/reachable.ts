import { expect, it } from "@jest/globals";
import {
  ReachableMixin,
  ReachableMixinRoot,
  type ReachableNode,
} from "../utils/incremental-reachable";
import { MapSet } from "../../util/data-structures/map-set";

type Log = {
  id: number;
  from: boolean;
  to: boolean;
};

type Change = [type: "add" | "remove", from: number, to: number];

class SomeNode implements ReachableNode {
  constructor(
    readonly id: number,
    readonly log: Log[]
  ) {}

  onReachabilityChange(from: boolean, to: boolean): void {
    this.log.push({
      id: this.id,
      from,
      to,
    });
  }
}

it("reachable (deterministic)", async () => {
  const log: Log[] = [];
  const nodes: ReachableMixin[] = new Array(20);
  for (let i = 0; i < nodes.length; i++) {
    nodes[i] =
      i === 0
        ? new ReachableMixinRoot(new SomeNode(i, log))
        : new ReachableMixin(new SomeNode(i, log));
  }

  const changes: Change[] = [
    ["add", 0, 1],
    ["add", 1, 2],
    ["add", 2, 3],
    ["add", 3, 4],
    ["remove", 2, 3],
  ];

  for (const [type, from, to] of changes) {
    if (type === "add") {
      nodes[to].onInEdgeAddition(nodes[from]);
    } else {
      nodes[to].onInEdgeRemoval(nodes[from]);
      nodes[from].performDeletionsAndRecheck();
    }
  }

  expect(log).toMatchSnapshot("log");

  const reachable: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].isReachable()) {
      reachable.push(i);
    }
  }

  expect(reachable).toStrictEqual([0, 1, 2]);
});

// From https://stackoverflow.com/a/12646864
function shuffleArray<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    let tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

it("reachable (random)", async () => {
  const log: Log[] = [];
  const nodes: ReachableMixin[] = new Array(20);
  for (let i = 0; i < nodes.length; i++) {
    nodes[i] =
      i === 0
        ? new ReachableMixinRoot(new SomeNode(i, log))
        : new ReachableMixin(new SomeNode(i, log));
  }

  const edges: [number, number][] = shuffleArray([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [2, 3],
  ]);

  const edgesAdded = new MapSet<number, number>();

  for (const [from, to] of edges) {
    if (edgesAdded.test(from, to)) {
      // Then remove
      edgesAdded.get(from).delete(to);
      nodes[to].onInEdgeRemoval(nodes[from]);
      nodes[from].performDeletionsAndRecheck();
    } else {
      // Then add
      edgesAdded.add(from, to);
      nodes[to].onInEdgeAddition(nodes[from]);
    }
  }

  const reachable: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].isReachable()) {
      reachable.push(i);
    }
  }

  console.log(edges);
  console.log(log);

  try {
    expect(reachable).toStrictEqual([0, 1, 2]);
  } catch (err) {
    throw err;
  }
});
