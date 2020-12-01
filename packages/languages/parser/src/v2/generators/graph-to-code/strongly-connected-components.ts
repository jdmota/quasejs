// Based on https://en.wikipedia.org/wiki/Path-based_strong_component_algorithm

type ComponentEdge<T, S> = readonly [S, T, S];

export class BaseComponent<T, S> {
  readonly id: number;
  readonly states: S[];
  readonly stateToComponent: ReadonlyMap<S, BaseComponent<T, S>>;
  readonly outEdges: ComponentEdge<T, S>[];
  readonly inEdges: ComponentEdge<T, S>[];
  readonly headers: Set<S>;

  constructor(
    id: number,
    stateToComponent: ReadonlyMap<S, BaseComponent<T, S>>
  ) {
    this.id = id;
    this.states = [];
    this.stateToComponent = stateToComponent;
    this.outEdges = [];
    this.inEdges = [];
    this.headers = new Set();
  }

  *destinations() {
    for (const [_, _2, dest] of this.outEdges) {
      yield this.stateToComponent.get(dest)!!;
    }
  }

  *[Symbol.iterator]() {
    for (const [_, transition, dest] of this.outEdges) {
      yield [transition, dest] as const;
    }
  }
}

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
          otherComponent.headers.add(dest);
        }
      }
    }
  }

  process(states: readonly S[]): readonly BaseComponent<T, S>[] {
    const s: S[] = [];
    const p: S[] = [];
    let c = 0;
    const order = new Map<S, number>();
    const components: BaseComponent<T, S>[] = [];
    const stateToComponent = new Map<S, BaseComponent<T, S>>();

    function search(v: S) {
      // 1. Set the preorder number of v to C, and increment C
      order.set(v, c);
      c++;

      // 2. Push v onto S and also onto P
      s.push(v);
      p.push(v);

      // 3. For each edge from v to a neighboring vertex w
      for (const w of this.destinations(v)) {
        const preorder = order.get(w);
        if (preorder == null) {
          // If the preorder number of w has not yet been assigned, recursively search w
          search(w);
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
          this.components.length,
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
        search(state);
      }
    }

    for (const c of components) {
      this.connect(c, stateToComponent);
    }

    return components;
  }
}
