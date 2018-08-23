/*!
 * This file is a modified version of https://github.com/avajs/option-chain/blob/master/index.js
 *
 * License: https://github.com/avajs/option-chain/blob/master/license
 *
 */

const noop = () => {};

export default function( options, fn, ctx, objTarget ) {

  function extend( target, data, ctx ) {
    Object.keys( options.methods ).forEach( key => {
      Object.defineProperty( target, key, {
        enumerable: true,
        configurable: true,
        get: function() {
          return wrap( data, options.methods[ key ], ctx || this );
        }
      } );
    } );

    Object.defineProperty( target, "runner", {
      enumerable: true,
      configurable: true,
      get: function() {
        return ctx || this;
      }
    } );

    return target;
  }

  function wrap( prevData, method, ctx ) {

    const data = Object.assign( {}, prevData );
    method( data );

    function wrapped( arg0, arg1 ) {
      return fn.call( ctx || this, Object.assign( {}, data ), arg0, arg1 );
    }

    return extend( wrapped, data, ctx );
  }

  if ( objTarget ) {
    return extend( objTarget, options.defaults );
  }

  return wrap( options.defaults, noop, ctx );
}
