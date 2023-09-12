import { expect } from "../../utils";
import { AnyRule } from "../grammar-builder";
import { AnyType, TypePolarity, polarity, FreeType } from "./types";

class Edge<N, E> {
  constructor(
    readonly a: Node<N, E>,
    readonly data: E,
    readonly b: Node<N, E>
  ) {}
}

class Node<N, E> {
  readonly inEdges: Edge<N, E>[] = [];
  readonly outEdges: Edge<N, E>[] = [];

  constructor(readonly data: N) {}
}

class Graph<N, E> {
  private readonly nodes = new Map<N, Node<N, E>>();

  node(data: N) {
    let node = this.nodes.get(data);
    if (node == null) {
      node = new Node(data);
      this.nodes.set(data, node);
    }
    return node;
  }

  edge(a: N, data: E, b: N) {
    const nodeA = this.node(a);
    const nodeB = this.node(b);
    const edge = new Edge(nodeA, data, nodeB);
    nodeA.outEdges.push(edge);
    nodeB.inEdges.push(edge);
  }

  *inDest(data: N) {
    const node = this.node(data);
    for (const edge of node.inEdges) {
      yield edge.a.data;
    }
  }

  *outDest(data: N) {
    const node = this.node(data);
    for (const edge of node.outEdges) {
      yield edge.b.data;
    }
  }
}

export class ConstraintsGraph extends Graph<AnyType, AnyRule | null> {
  private upperHelper(type: AnyType, set: Set<AnyType>, seen: Set<AnyType>) {
    if (seen.has(type)) return;
    seen.add(type);
    const p = polarity(type);
    switch (p) {
      case TypePolarity.NONE:
        for (const dest of this.outDest(type)) {
          this.upperHelper(dest, set, seen);
        }
        break;
      case TypePolarity.NEGATIVE:
        for (const dest of this.outDest(type)) {
          this.upperHelper(dest, set, seen);
        }
        break;
      case TypePolarity.POSITIVE:
      case TypePolarity.BIPOLAR:
      case null:
        set.add(type);
        break;
      default:
        expect<never>(p);
    }
  }

  private lowerHelper(type: AnyType, set: Set<AnyType>, seen: Set<AnyType>) {
    if (seen.has(type)) return;
    seen.add(type);
    const p = polarity(type);
    switch (p) {
      case TypePolarity.NONE:
        for (const dest of this.inDest(type)) {
          this.lowerHelper(dest, set, seen);
        }
        break;
      case TypePolarity.POSITIVE:
        for (const dest of this.inDest(type)) {
          this.lowerHelper(dest, set, seen);
        }
        break;
      case TypePolarity.NEGATIVE:
      case TypePolarity.BIPOLAR:
      case null:
        set.add(type);
        break;
      default:
        expect<never>(p);
    }
  }

  upper(type: FreeType) {
    const set = new Set<AnyType>();
    const seen = new Set<AnyType>([type]);
    for (const dest of this.outDest(type)) {
      this.upperHelper(dest, set, seen);
    }
    return set;
  }

  lower(type: FreeType) {
    const set = new Set<AnyType>();
    const seen = new Set<AnyType>([type]);
    for (const dest of this.inDest(type)) {
      this.lowerHelper(dest, set, seen);
    }
    return set;
  }
}
