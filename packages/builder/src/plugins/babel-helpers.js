const helpers = require( "babel-helpers" );
const generator = require( "babel-generator" ).default;
const t = require( "babel-types" );

export default function( whitelist ) {
  if ( Object.keys( whitelist ).length === 0 ) {
    return "{}";
  }

  const body = [
    t.variableDeclaration( "var", [ t.variableDeclarator( t.identifier( "$b" ), t.objectExpression( [] ) ) ] )
  ];

  helpers.list.forEach( name => {
    if ( !whitelist[ name ] ) {
      return;
    }
    const helper = helpers.get( name ); // { nodes: [], globals: [] }
    for ( const node of helper.nodes ) {
      if ( node.type === "ExportDefaultDeclaration" ) {
        if ( node.declaration.type === "FunctionDeclaration" ) {
          node.declaration.type = "FunctionExpression";
        }
        body.push(
          t.expressionStatement(
            t.assignmentExpression(
              "=", t.memberExpression( t.identifier( "$b" ), t.identifier( name ) ), node.declaration
            )
          )
        );
      } else {
        body.push( node );
      }
    }
  } );

  body.push( t.returnStatement( t.identifier( "$b" ) ) );

  const ast = t.callExpression( t.functionExpression( null, [], t.blockStatement( body ) ), [] );
  return generator( ast, { minified: true } ).code;
}
