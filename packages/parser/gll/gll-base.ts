/*
Resources:

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

/*
The following implementation uses the better GSS structure from "Faster, Practical GLL Parsing"
It also draws from "One Parser to Rule Them All"
https://dl.acm.org/doi/pdf/10.1145/2814228.2814242
And the thesis "Practical General Top-down Parsers"
https://pure.uva.nl/ws/files/36086100/Thesis.pdf
*/

import { MapKeyToValue } from "../../util/data-structures/map-key-to-value";
import { type ObjectHashEquals, setAdd } from "../../util/miscellaneous";

export interface IGLLLabel extends ObjectHashEquals {
  getRule(): string;
}

export interface IEnv<E extends IEnv<E>> extends ObjectHashEquals {
  assign(key: string, value: unknown): E;
}

export interface IRet extends ObjectHashEquals {
  readonly value: unknown;
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

// Edge (grammar slot, env)
export class GSSEdge<GLLLabel extends IGLLLabel, Env extends IEnv<Env>>
  implements ObjectHashEquals
{
  constructor(
    readonly label: GLLLabel,
    readonly env: Env
  ) {}

  hashCode(): number {
    return this.label.hashCode() * this.env.hashCode();
  }

  equals(other: unknown): boolean {
    return (
      other instanceof GSSEdge &&
      this.label.equals(other.label) &&
      this.env.equals(other.env)
    );
  }
}

export class GSSNode<
  GLLLabel extends IGLLLabel,
  Args extends ObjectHashEquals,
  Env extends IEnv<Env>,
> implements ObjectHashEquals
{
  private readonly childNodes: MapKeyToValue<
    GSSEdge<GLLLabel, Env>,
    Set<GSSNode<GLLLabel, Args, Env>>
  >;

  constructor(
    readonly rule: string,
    readonly args: Args,
    readonly level: InputPosition
  ) {
    this.childNodes = new MapKeyToValue();
  }

  children() {
    return this.childNodes[Symbol.iterator]();
  }

  hasChildren() {
    return this.childNodes.size > 0;
  }

  addEdgeTo(label: GLLLabel, env: Env, u: GSSNode<GLLLabel, Args, Env>) {
    const set = this.childNodes.computeIfAbsent(
      new GSSEdge(label, env),
      () => new Set()
    );
    const added = setAdd(set, u);
    if (added && !this.hasLeftRecursionCache) {
      this.hasLeftRecursionCache = null;
    }
    return added;
  }

  // In each GLL algorithm instance, there should only be one GSSNode instance with these properties

  hashCode(): number {
    return this.rule.length * this.args.hashCode() * (this.level + 1);
  }

  equals(other: unknown): boolean {
    return (
      other instanceof GSSNode &&
      this.rule === other.rule &&
      this.level === other.level &&
      this.args.equals(other.args)
    );
  }

  private hasLeftRecursionCache: boolean | null = null;

  hasLeftRecursion() {
    if (this.hasLeftRecursionCache == null) {
      let prev: GSSNode<GLLLabel, Args, Env>[] = [this];
      let next: GSSNode<GLLLabel, Args, Env>[] = [];
      while (prev.length) {
        for (const n of prev) {
          // As we traverse the children, the level can never increase
          for (const [l, set] of n.children()) {
            for (const c of set) {
              if (c.equals(this)) {
                return (this.hasLeftRecursionCache = true);
              }
              if (c.level === this.level) {
                next.push(c);
              }
            }
          }
        }
        prev = next;
        next = [];
      }
      return (this.hasLeftRecursionCache = false);
    }
    return this.hasLeftRecursionCache;
  }
}

// Tuple (grammar slot, GSS node, input position, env)
export class GLLDescriptor<
  GLLLabel extends IGLLLabel,
  Args extends ObjectHashEquals,
  Env extends IEnv<Env>,
> implements ObjectHashEquals
{
  constructor(
    readonly label: GLLLabel,
    readonly node: GSSNode<GLLLabel, Args, Env>,
    readonly pos: InputPosition,
    readonly env: Env
  ) {}

  hashCode(): number {
    return (
      this.label.hashCode() *
      this.node.hashCode() *
      this.env.hashCode() *
      (this.pos + 1)
    );
  }

  equals(other: unknown): boolean {
    return (
      other instanceof GLLDescriptor &&
      this.label.equals(other.label) &&
      this.node === other.node && // Use === instead of equals() so that descriptors from different analyzers are not considered equal
      this.pos === other.pos &&
      this.env.equals(other.env)
    );
  }
}

// Tuple (input position, returned value)
export class GLLPop<Ret extends ObjectHashEquals> implements ObjectHashEquals {
  constructor(
    readonly pos: InputPosition,
    readonly retValue: Ret
  ) {}

  hashCode(): number {
    return this.retValue.hashCode() * (this.pos + 1);
  }

  equals(other: unknown): boolean {
    return (
      other instanceof GLLPop &&
      this.pos === other.pos &&
      this.retValue.equals(other.retValue)
    );
  }
}

// A set of the descriptors that still have to be processed by the GLL algorithm
type GLL_R<
  GLLLabel extends IGLLLabel,
  Args extends ObjectHashEquals,
  Env extends IEnv<Env>,
> = Array<GLLDescriptor<GLLLabel, Args, Env>>;

// A set of descriptors that have been processed by the GLL algorithm
type GLL_U<
  GLLLabel extends IGLLLabel,
  Args extends ObjectHashEquals,
  Env extends IEnv<Env>,
> = SSet<GLLDescriptor<GLLLabel, Args, Env>>;

// A set of tuples (GSSNode, input position, returned value) for which the GLL algorithm has performed a pop() statement
type GLL_P<
  GLLLabel extends IGLLLabel,
  Args extends ObjectHashEquals,
  Env extends IEnv<Env>,
  Ret extends ObjectHashEquals,
> = MapKeyToValue<GSSNode<GLLLabel, Args, Env>, SSet<GLLPop<Ret>>>;

export abstract class GLLBase<
  L extends IGLLLabel,
  Args extends ObjectHashEquals,
  Env extends IEnv<Env>,
  Ret extends IRet,
> {
  protected curr: GSSNode<L, Args, Env>;
  protected pos: InputPosition;
  protected currL: L;
  protected currEnv: Env;

  protected readonly rSet: GLL_R<L, Args, Env> = [];
  protected readonly uSet: GLL_U<L, Args, Env> = new SSet();
  protected readonly pSet: GLL_P<L, Args, Env, Ret> = new MapKeyToValue();

  protected readonly nodes = new MapKeyToValue<
    GSSNode<L, Args, Env>,
    GSSNode<L, Args, Env>
  >();

  constructor(initialLabel: L, initialArgs: Args, initialEnv: Env) {
    this.pos = 0;
    this.curr = this.ensureGLLNode(initialLabel.getRule(), initialArgs, 0);
    this.currL = initialLabel;
    this.currEnv = initialEnv;
  }

  addInitial(pos: InputPosition) {
    this.add(this.currL, this.curr, pos, this.currEnv);
  }

  run() {
    while (this.loop()) {}
  }

  protected loop() {
    if (this.rSet.length > 0) {
      const desc = this.rSet.pop()!;
      const { label: l, node: u, pos: j, env } = desc;
      this.curr = u;
      this.pos = j;
      this.currL = l;
      this.currEnv = env;
      this.goto(desc);
      return true;
    }
    this.checkEnd();
    return false;
  }

  protected checkEnd(): void {}

  protected add(l: L, u: GSSNode<L, Args, Env>, j: InputPosition, env: Env) {
    const d = new GLLDescriptor(l, u, j, env);
    if (this.uSet.add(d)) {
      this.rSet.push(d);
    }
  }

  protected abstract createEnv(rule: string, args: Args): Env;

  // 'l' is the label we will return to after popping what we are pushing now
  // 'dest' is the label we are going to
  // Returns true if a new node was created
  protected create(l: L, dest: L, args: Args) {
    const u = this.curr;
    const j = this.pos;
    const env = this.currEnv;
    const newNode = new GSSNode<L, Args, Env>(dest.getRule(), args, j);
    let v = this.nodes.get(newNode);
    if (v) {
      if (v.addEdgeTo(l, env, u)) {
        for (const { pos, retValue } of this.pSet.get(v) ?? new SSet()) {
          this.add(l, u, pos, env.assign("#tmp", retValue.value));
        }
      }
      return false;
    } else {
      this.nodes.set(newNode, newNode);
      v = newNode;
      v.addEdgeTo(l, env, u);
      this.add(dest, v, j, this.createEnv(dest.getRule(), args));
      return true;
    }
  }

  // Returns true if it popped something
  protected pop(retValue: Ret) {
    const v = this.curr;
    const k = this.pos;
    const added = this.pSet
      .computeIfAbsent(v, () => new SSet())
      .add(new GLLPop(k, retValue));
    if (added) {
      let hasChildren = false;
      for (const [{ label, env }, us] of v.children()) {
        for (const u of us) {
          this.add(label, u, k, env.assign("#tmp", retValue.value));
        }
        hasChildren = true;
      }
      return hasChildren;
    }
    return true;
  }

  ensureGLLNode(
    rule: string,
    args: Args,
    pos: InputPosition
  ): GSSNode<L, Args, Env> {
    const newNode = new GSSNode<L, Args, Env>(rule, args, pos);
    return this.nodes.computeIfAbsent(newNode, () => newNode);
  }

  abstract goto(desc: GLLDescriptor<L, Args, Env>): void;
}
