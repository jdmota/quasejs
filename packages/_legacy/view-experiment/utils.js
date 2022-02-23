export function error( msg, loc ) {
  throw new Error( msg + ( loc ? " - " + loc.line + ":" + loc.col + "" : "" ) );
}

function findAllHelper( result, node, predicate ) {
  if ( predicate( node ) ) {
    result.push( node );
  }
  if ( node.childNodes ) {
    for ( const child of node.childNodes ) {
      findAllHelper( result, child, predicate );
    }
  }
  return result;
}

export function findAll( node, predicate ) {
  return findAllHelper( [], node, predicate );
}

export function findIn( node, predicate ) {
  const result = [];
  if ( node.childNodes ) {
    for ( const child of node.childNodes ) {
      if ( predicate( child ) ) {
        result.push( child );
      }
    }
  }
  return result;
}
