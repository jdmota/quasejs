export const EPSILON = Symbol( "EPSILON" );

export function printLoc( node ) {
  return `${node.loc.start.line}:${node.loc.start.column}-${node.loc.end.line}:${node.loc.end.column}`;
}
