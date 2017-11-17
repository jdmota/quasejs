import SYMBOL_OBSERVABLE from "./observable-symbol";

export default function( value ) {
  return new Promise( function( resolve, reject ) {
    value[ SYMBOL_OBSERVABLE() ]().subscribe( {
      complete: resolve,
      error: reject
    } );
  } );
}
