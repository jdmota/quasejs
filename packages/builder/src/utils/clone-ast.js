export default function clone( node, stack ) {
  if ( node === null || typeof node !== "object" || typeof node === "function" ) {
    return node;
  }

  if ( stack ) {
    const stacked = stack.get( node );
    if ( stacked ) {
      return stacked;
    }
  } else {
    stack = new Map();
  }

  if ( Array.isArray( node ) ) {
    const cloned = new Array( node.length );
    stack.set( node, cloned );
    for ( let i = 0; i < node.length; i++ ) {
      cloned[ i ] = clone( node[ i ], stack );
    }
    return cloned;
  }

  const cloned = {};
  stack.set( node, cloned );
  for ( const key in node ) {
    cloned[ key ] = clone( node[ key ], stack );
  }

  return cloned;
}
