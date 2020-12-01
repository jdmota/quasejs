export abstract class BaseTopologicalOrder<State> {
  abstract inEdgesAmount(state: State): number;

  abstract destinations(state: State): IterableIterator<State>;

  process(states: readonly State[]): readonly State[] {
    const inEdgesMap = new Map<State, number>();
    const zeroEdges: State[] = [];
    const order: State[] = [];

    for (const s of states) {
      const inEdges = this.inEdgesAmount(s);
      inEdgesMap.set(s, inEdges);
      if (inEdges === 0) {
        zeroEdges.push(s);
      }
    }

    while (zeroEdges.length > 0) {
      const state = zeroEdges.pop()!!;
      order.push(state);

      for (const dest of this.destinations(state)) {
        const inEdges = inEdgesMap.get(dest)!! - 1;
        inEdgesMap.set(dest, inEdges);
        if (inEdges === 0) {
          zeroEdges.push(dest);
        }
      }
    }

    return order;
  }
}
