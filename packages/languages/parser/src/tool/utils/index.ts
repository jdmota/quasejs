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
