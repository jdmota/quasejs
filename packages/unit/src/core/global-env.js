const freeGlobal = typeof global === "object" && global;
const freeSelf = typeof self === "object" && self; // eslint-disable-line no-undef
const root = freeGlobal || freeSelf || Function( "return this" )(); // eslint-disable-line no-new-func

const has = Object.prototype.hasOwnProperty;

// Returns a new Array with the elements that are in a but not in b
function diff( a, b ) {
  let i, j, found = false, result = [];

  for ( i = 0; i < a.length; i++ ) {
    found = false;
    for ( j = 0; j < b.length; j++ ) {
      if ( a[ i ] === b[ j ] ) {
        found = true;
        break;
      }
    }
    if ( !found ) {
      result.push( a[ i ] );
    }
  }

  return result;
}

class GlobalEnv {

  constructor( allowedVars ) {
    this.allowedVars = allowedVars;
    this.initialVars = null;
    this.root = root;
  }

  getVars() {
    const vars = [];
    for ( const key in this.root ) {
      if ( has.call( this.root, key ) && this.checkNotAllowed( key ) ) {
        vars.push( key );
      }
    }
    return vars;
  }

  start() {
    this.initialVars = this.getVars();
    return this;
  }

  checkNotAllowed( name ) {
    let i = this.allowedVars.length;
    while ( i-- ) {
      if ( this.allowedVars[ i ] === false ) {
        return true;
      }
      if ( this.allowedVars[ i ] === true || this.allowedVars[ i ] === name ) {
        return false;
      }
    }
    return true;
  }

  check() {

    const old = this.initialVars;

    if ( !old ) {
      return;
    }

    const errors = [];
    const vars = this.getVars();

    const newGlobals = diff( vars, old );
    if ( newGlobals.length > 0 ) {
      errors.push( "Introduced global variable(s): " + newGlobals.join( ", " ) );
    }

    const deletedGlobals = diff( old, vars );
    if ( deletedGlobals.length > 0 ) {
      errors.push( "Deleted global variable(s): " + deletedGlobals.join( ", " ) );
    }

    if ( errors.length ) {
      return new Error( errors.join( "; " ) );
    }

  }

}

export default GlobalEnv;
