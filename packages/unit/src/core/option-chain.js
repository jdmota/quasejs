/*!
 * This file is a modified version of https://github.com/avajs/option-chain/blob/master/index.js
 *
 * License: https://github.com/avajs/option-chain/blob/master/license
 *
 */

const objectAssign = Object.assign;

export default function( options, fn, target ) {
  const chainables = options.chainableMethods;

  function extend( target, getter, ctx ) {
    Object.keys( chainables ).forEach( key => {
      Object.defineProperty( target, key, {
        enumerable: true,
        configurable: true,
        get: function() {
          return wrap( getter, chainables[ key ], ctx || this );
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
  }

  function wrap( createOpts, extensionOpts, ctx ) {
    function wrappedOpts() {
      return objectAssign( createOpts(), extensionOpts );
    }

    function wrappedFn( arg0, arg1 ) {
      return fn.call( ctx || this, wrappedOpts(), arg0, arg1 );
    }

    extend( wrappedFn, wrappedOpts, ctx );

    return wrappedFn;
  }

  let defaults = options.defaults;

  function copyDefaults() {
    return objectAssign( {}, defaults );
  }

  extend( target, copyDefaults );

}
