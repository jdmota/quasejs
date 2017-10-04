const helpers = require( "babel-helpers" );
const generator = require( "babel-generator" ).default;
const t = require( "babel-types" );

export default function( whitelist ) {
  const props = [];
  helpers.list.forEach( name => {
    if ( whitelist.indexOf( name ) < 0 ) {
      return;
    }
    props.push( t.objectProperty( t.identifier( name ), helpers.get( name ) ) );
  } );
  return generator( t.objectExpression( props ), { minified: true } ).code;
}
