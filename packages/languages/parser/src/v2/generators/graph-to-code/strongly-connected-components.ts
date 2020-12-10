// Based on https://en.wikipedia.org/wiki/Path-based_strong_component_algorithm

export type BaseComponentEdge<T, S> = readonly [S, T, S];

export class BaseComponent<T, S> {
  readonly id: number;
  readonly states: S[];
  readonly stateToComponent: ReadonlyMap<S, BaseComponent<T, S>>;
  readonly outEdges: BaseComponentEdge<T, S>[];
  readonly inEdges: BaseComponentEdge<T, S>[];
  // Entry points of this component (nodes reachable from outside or the start node)
  readonly entries: Set<S>;

  constructor(
    id: number,
    stateToComponent: ReadonlyMap<S, BaseComponent<T, S>>
  ) {
    this.id = id;
    this.states = [];
    this.stateToComponent = stateToComponent;
    this.outEdges = [];
    this.inEdges = [];
    this.entries = new Set();
  }

  isLoop(scc: BaseSCC<T, S>) {
    // SCCs with more than one element are loops
    // (unless a state has a transition to itself)
    if (this.states.length > 1) {
      return true;
    }
    const state = this.states[0];
    for (const dest of scc.destinations(state)) {
      if (dest === state) {
        return true;
      }
    }
    return false;
  }

  *destinations() {
    for (const [_, _2, dest] of this.outEdges) {
      yield this.stateToComponent.get(dest)!!;
    }
  }

  *[Symbol.iterator]() {
    for (const [_, transition, dest] of this.outEdges) {
      yield [transition, this.stateToComponent.get(dest)!!] as const;
    }
  }
}

type SCCResult<T, S> = {
  readonly start: BaseComponent<T, S>;
  readonly components: readonly BaseComponent<T, S>[];
  readonly stateToComponent: ReadonlyMap<S, BaseComponent<T, S>>;
};

export abstract class BaseSCC<T, S> {
  abstract inEdgesAmount(state: S): number;

  abstract destinations(state: S): IterableIterator<S>;

  abstract outEdges(state: S): IterableIterator<readonly [T, S]>;

  private connect(
    component: BaseComponent<T, S>,
    stateToComponent: Map<S, BaseComponent<T, S>>
  ) {
    for (const state of component.states) {
      for (const [transition, dest] of this.outEdges(state)) {
        const otherComponent = stateToComponent.get(dest)!!;
        if (component !== otherComponent) {
          const tuple = [state, transition, dest] as const;
          component.outEdges.push(tuple);
          otherComponent.inEdges.push(tuple);
          otherComponent.entries.add(dest);
        }
      }
    }
  }

  process(start: S, states: Iterable<S>): SCCResult<T, S> {
    const s: S[] = [];
    const p: S[] = [];
    let c = 0;
    const order = new Map<S, number>();
    const components: BaseComponent<T, S>[] = [];
    const stateToComponent = new Map<S, BaseComponent<T, S>>();

    function search(self: BaseSCC<T, S>, v: S) {
      // 1. Set the preorder number of v to C, and increment C
      order.set(v, c);
      c++;

      // 2. Push v onto S and also onto P
      s.push(v);
      p.push(v);

      // 3. For each edge from v to a neighboring vertex w
      for (const w of self.destinations(v)) {
        const preorder = order.get(w);
        if (preorder == null) {
          // If the preorder number of w has not yet been assigned, recursively search w
          search(self, w);
        } else {
          // Otherwise, if w has not yet been assigned to a strongly connected component:
          if (!stateToComponent.has(v)) {
            // Repeatedly pop vertices from P until the top element of P has a preorder number less than or equal to the preorder number of w
            while (order.get(p[p.length - 1])!! > preorder) {
              p.pop();
            }
          }
        }
      }

      // 4. If v is the top element of P
      if (v === p[p.length - 1]) {
        // Pop vertices from S until v has been popped, and assign the popped vertices to a new component
        const component = new BaseComponent<T, S>(
          components.length,
          stateToComponent
        );
        do {
          const x = s.pop()!!;
          component.states.push(x);
          stateToComponent.set(x, component);
          if (x === v) break;
        } while (true);
        components.push(component);

        // Pop v from P
        p.pop();
      }
    }

    for (const state of states) {
      if (!order.has(state)) {
        search(this, state);
      }
    }

    for (const c of components) {
      this.connect(c, stateToComponent);
    }

    // initialComponent.headers.length === 0
    const initialComponent = stateToComponent.get(start)!!;
    initialComponent.entries.add(start);
    // initialComponent.headers.length === 1
    // initialComponent.inEdges.length === 0

    return {
      start: initialComponent,
      components,
      stateToComponent,
    };
  }
}
