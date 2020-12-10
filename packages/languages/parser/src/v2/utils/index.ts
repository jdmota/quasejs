type Node = {
  loc: {
    start: {
      line: number;
      column: number;
    };
    end: {
      line: number;
      column: number;
    };
  };
};

export function printLoc(node: Node) {
  return `${node.loc.start.line}:${node.loc.start.column}-${node.loc.end.line}:${node.loc.end.column}`;
}

export function never(_: never): never {
  throw new Error("Never");
}

export function first<T>(it: Iterable<T>): T {
  for (const value of it) {
    return value;
  }
  throw new Error("Iterable has zero elements");
}
