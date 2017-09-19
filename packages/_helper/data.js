import { SYMBOL_SUPPORT } from "./symbols";

const EXPANDO = ( SYMBOL_SUPPORT && Symbol( "quasejs internal" ) ) ||
  ( "__quasejs__" + Math.random() ).replace( /0\./g, "" );

function InternalData() {
  this.view = null;
  this.events = null;
}
InternalData.prototype = Object.create( null );

export default {

  setup: function( obj, name, value, optimize ) {
    let data = obj[ EXPANDO ];
    if ( !data ) {
      data = new InternalData();
      if ( optimize || SYMBOL_SUPPORT ) {
        obj[ EXPANDO ] = data;
      } else {

        // Non-enumerable property
        Object.defineProperty( obj, EXPANDO, { writable: true, value: data } );
      }
    }
    return data[ name ] ? data[ name ] : ( data[ name ] = value );
  },

  get: function( obj, name ) {
    let data = obj[ EXPANDO ];
    return data && data[ name ];
  },

  remove: function( obj, name ) {
    let data = obj[ EXPANDO ];
    if ( data ) {
      data[ name ] = null;
    }
  }

};
