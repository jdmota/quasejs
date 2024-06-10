/*
Original GLL paper: https://dotat.at/tmp/gll.pdf

GLL parse-tree generation: https://www.sciencedirect.com/science/article/pii/S0167642312000627

Interesting master thesis (although it seems to have some errors in the pseudo code): https://pure.tue.nl/ws/files/46987757/782897-1.pdf

An implementation in Scala: https://github.com/djspiewak/gll-combinators/blob/master/src/main/scala/com/codecommit/gll/Parsers.scala

A reference implementation: https://github.com/AJohnstone2007/referenceImplementation/blob/main/src/uk/ac/rhul/cs/csle/art/cfg/gll/GLLBaseLine.java

Interesting optimizations and a better GSS structure: "Faster, Practical GLL Parsing"
https://link.springer.com/chapter/10.1007/978-3-662-46663-6_5
https://cdn.jsdelivr.net/gh/iguana-parser/papers@master/cc15.pdf

More optimizations in "Structuring the GLL parsing algorithm for performance"
https://pure.royalholloway.ac.uk/ws/portalfiles/portal/26408385/postprint.pdf

Another optimization using CRF instead of GSS: "Derivation representation using binary subtree sets"
*/

import { ObjectHashEquals, setAdd } from "../utils/index.ts";
import { MapKeyToValue } from "../utils/map-key-to-value.ts";

export interface IGLLLabel extends ObjectHashEquals {
  getRule(): string;
}

class SSet<T extends ObjectHashEquals> {
  private readonly map = new MapKeyToValue<T, boolean>();

  has(key: T): boolean {
    return !!this.map.get(key);
  }

  add(key: T): boolean {
    return this.map.add(key, true);
  }

  delete(key: T): boolean {
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  *[Symbol.iterator]() {
    for (const [key, val] of this.map) {
      if (val) yield key;
    }
  }
}

type InputPosition = number;

export class GSSNode<GLLLabel extends IGLLLabel> implements ObjectHashEquals {
  readonly rule: string;
  readonly level: InputPosition;
  private readonly childNodes: MapKeyToValue<GLLLabel, Set<GSSNode<GLLLabel>>>;

  constructor(rule: string, pos: InputPosition) {
    this.rule = rule;
    this.level = pos;
    this.childNodes = new MapKeyToValue();
  }

  children() {
    return this.childNodes[Symbol.iterator]();
  }

  addEdgeTo(edge: GLLLabel, u: GSSNode<GLLLabel>) {
    const set = this.childNodes.computeIfAbsent(edge, () => new Set());
    return setAdd(set, u);
  }

  // In each GLL algorithm instance, there should only be one GSSNode instance with these properties

  hashCode(): number {
    return this.rule.length * (this.level + 1);
  }

  equals(other: unknown): boolean {
    return (
      other instanceof GSSNode &&
      this.rule === other.rule &&
      this.level === other.level
    );
  }
}

// Tuple (grammar slot, GSS node, input position)
export class GLLDescriptor<GLLLabel extends IGLLLabel>
  implements ObjectHashEquals
{
  constructor(
    readonly label: GLLLabel,
    readonly node: GSSNode<GLLLabel>,
    readonly pos: InputPosition
  ) {}

  hashCode(): number {
    return this.label.hashCode() * this.node.hashCode() * (this.pos + 1);
  }

  equals(other: unknown): boolean {
    return (
      other instanceof GLLDescriptor &&
      this.label.equals(other.label) &&
      this.node.equals(other.node) &&
      this.pos === other.pos
    );
  }
}

// A set of the descriptors that still have to be processed by the GLL algorithm
type GLL_R<GLLLabel extends IGLLLabel> = Array<GLLDescriptor<GLLLabel>>;

// A set of descriptors that have been processed by the GLL algorithm
type GLL_U<GLLLabel extends IGLLLabel> = SSet<GLLDescriptor<GLLLabel>>;

// A set of tuples (GSSNode, input position) for which the GLL algorithm has performed a pop() statement
type GLL_P<GLLLabel extends IGLLLabel> = MapKeyToValue<
  GSSNode<GLLLabel>,
  Set<InputPosition>
>;

// The base GLL algorithm with the GSS optimization from "Faster, Practical GLL Parsing"
export abstract class GLLBase<L extends IGLLLabel> {
  protected curr: GSSNode<L>;
  protected pos: InputPosition;
  protected currL: L;

  protected readonly rSet: GLL_R<L> = [];
  protected readonly uSet: GLL_U<L> = new SSet();
  protected readonly pSet: GLL_P<L> = new MapKeyToValue();

  protected readonly nodes = new MapKeyToValue<GSSNode<L>, GSSNode<L>>();

  constructor(initialLabel: L) {
    this.pos = 0;
    this.curr = this.ensureGLLNode(initialLabel.getRule(), 0);
    this.currL = initialLabel;
  }

  addInitial(pos: InputPosition) {
    this.add(this.currL, this.curr, pos);
  }

  run() {
    while (this.loop()) {}
  }

  protected loop() {
    if (this.rSet.length > 0) {
      const desc = this.rSet.pop()!;
      const { label: l, node: u, pos: j } = desc;
      this.curr = u;
      this.pos = j;
      this.currL = l;
      this.goto(l, desc);
      return true;
    }
    this.checkEnd();
    return false;
  }

  protected checkEnd(): void {}

  protected add(l: L, u: GSSNode<L>, j: InputPosition) {
    const d = new GLLDescriptor(l, u, j);
    if (this.uSet.add(d)) {
      this.rSet.push(d);
    }
  }

  // 'l' is the label we will return to after popping what we are pushing now
  // 'dest' is the label we are going to
  protected create(l: L, dest: L) {
    const u = this.curr;
    const j = this.pos;
    const newNode = new GSSNode<L>(dest.getRule(), j);
    let v = this.nodes.get(newNode);
    if (v) {
      if (v.addEdgeTo(l, u)) {
        for (const k of this.pSet.get(v) ?? new Set()) {
          this.add(l, u, k);
        }
      }
    } else {
      this.nodes.set(newNode, newNode);
      v = newNode;
      v.addEdgeTo(l, u);
      this.add(dest, v, j);
    }
  }

  protected pop() {
    const v = this.curr;
    const k = this.pos;
    const added = setAdd(
      this.pSet.computeIfAbsent(v, () => new Set()),
      k
    ); // add (v, k)
    if (added) {
      let hasChildren = false;
      for (const [l, us] of v.children()) {
        for (const u of us) {
          this.add(l, u, k);
        }
        hasChildren = true;
      }
      return hasChildren;
    }
    return true;
  }

  protected ensureGLLNode(rule: string, pos: InputPosition): GSSNode<L> {
    const newNode = new GSSNode<L>(rule, pos);
    return this.nodes.computeIfAbsent(newNode, () => newNode);
  }

  abstract goto(l: L, desc: GLLDescriptor<L>): void;
}
