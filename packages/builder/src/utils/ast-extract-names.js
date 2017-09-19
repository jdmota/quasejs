// Adapted from https://github.com/rollup/rollup/blob/master/src/ast/utils/extractNames.js
// Ref https://github.com/estree/estree/

const extractors = {
  Identifier( names, param ) {
    names.push( param.name );
  },

  ObjectPattern( names, param ) {
    param.properties.forEach( prop => {
      extractors[ prop.value.type ]( names, prop.value );
    } );
  },

  ArrayPattern( names, param ) {
    param.elements.forEach( element => {
      if ( element ) {
        extractors[ element.type ]( names, element );
      }
    } );
  },

  RestElement( names, param ) {
    extractors[ param.argument.type ]( names, param.argument );
  },

  AssignmentPattern( names, param ) {
    extractors[ param.left.type ]( names, param.left );
  },

  FunctionDeclaration( names, param ) {
    extractors[ param.id.type ]( names, param.id );
  },

  VariableDeclaration( names, param ) {
    param.declarations.forEach( decl => {
      extractors[ decl.id.type ]( names, decl.id );
    } );
  }
};

export default function extractNames( param ) {
  const names = [];
  if ( param ) {
    extractors[ param.type ]( names, param );
  }
  return names;
}
