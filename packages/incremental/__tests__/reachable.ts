import { expect, it } from "@jest/globals";
import {
  type ReachableNode,
  ReachableMixin,
} from "../utils/incremental-reachable";
import { MapSet } from "../../util/data-structures/map-set";
import { shuffleArray } from "../../util/random";

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
    nodes[i] = new ReachableMixin(new SomeNode(i, log), i === 0);
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
      nodes[from].performDeletionsAndRecheck(ReachableMixin.prepareRecheck());
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

it("reachable (random)", async () => {
  const log: Log[] = [];
  const nodes: ReachableMixin[] = new Array(20);
  for (let i = 0; i < nodes.length; i++) {
    nodes[i] = new ReachableMixin(new SomeNode(i, log), i === 0);
  }

  const edges: [number, number][] = shuffleArray([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [2, 3],
    [4, 5],
    [5, 4],
    [3, 5],
    [6, 2],
    [2, 6],
  ]);

  const edgesAdded = new MapSet<number, number>();

  for (const [from, to] of edges) {
    if (edgesAdded.test(from, to)) {
      // Then remove
      edgesAdded.get(from).delete(to);
      nodes[to].onInEdgeRemoval(nodes[from]);
      nodes[from].performDeletionsAndRecheck(ReachableMixin.prepareRecheck());
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
    expect(reachable).toStrictEqual([0, 1, 2, 6]);
  } catch (err) {
    throw err;
  }
});

it("reachable (random) (delayed removal)", async () => {
  const log: Log[] = [];
  const nodes: ReachableMixin[] = new Array(20);
  for (let i = 0; i < nodes.length; i++) {
    nodes[i] = new ReachableMixin(new SomeNode(i, log), i === 0);
  }

  const edges: [number, number][] = shuffleArray([
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [2, 3],
    [4, 5],
    [5, 4],
    [3, 5],
    [6, 2],
    [2, 6],
  ]);

  const edgesAdded = new MapSet<number, number>();

  for (const [from, to] of edges) {
    if (edgesAdded.test(from, to)) {
      // Then remove
      edgesAdded.get(from).delete(to);
      nodes[to].onInEdgeRemoval(nodes[from]);
    } else {
      // Then add
      edgesAdded.add(from, to);
      nodes[to].onInEdgeAddition(nodes[from]);
    }
  }

  const recheck = ReachableMixin.prepareRecheck();
  for (const node of nodes) {
    node.performDeletionsAndRecheck(recheck);
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
    expect(reachable).toStrictEqual([0, 1, 2, 6]);
  } catch (err) {
    throw err;
  }
});
