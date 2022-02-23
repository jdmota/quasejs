if ( node.callee.type === "Import" ) {
  const arg = node.arguments[ 0 ];
  if ( arg.type === "StringLiteral" ) {
    addDep( deps, arg, true );
    dynamicImports.push( {
      isGlob: false,
      name: arg.value,
      loc: getLoc( arg )
    } );
  } else if ( arg.type === "TemplateLiteral" ) {
    let glob = "";
    for ( const quasi of arg.quasis ) {
      glob += quasi.value.cooked + "*";
    }
    glob = glob.slice( 0, -1 ).replace( /\/\*\//g, "/?*/" );
    dynamicImports.push( {
      isGlob: arg.quasis.length > 1,
      name: glob,
      loc: getLoc( arg )
    } );
    // TODO test this
  } else {
    // TODO warn that we cannot detect what you are trying to import on Module
    // TODO if it's an identifier, try to get it if it is constant?
    dynamicImports.push( {
      warn: true,
      loc: getLoc( arg )
    } );
  }
}
