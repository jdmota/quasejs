import { Type } from "./compiler";

export function isBoolean( node: Type ): boolean {
  if ( node.type === "Union" ) {
    return isBoolean( node.type1 ) && isBoolean( node.type2 );
  }
  return (
    node.type === "Boolean" ||
    ( node.type === "Identifier" && node.name === "boolean" )
  );
}

export function isNumber( node: Type ): boolean {
  if ( node.type === "Union" ) {
    return isNumber( node.type1 ) && isNumber( node.type2 );
  }
  return (
    node.type === "Number" ||
    ( node.type === "Identifier" && node.name === "number" )
  );
}
