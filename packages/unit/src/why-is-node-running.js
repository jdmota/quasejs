import { getStack } from "@quase/error";

const asyncHooks = require( "async_hooks" );

const FAKE_RESOURCE = new asyncHooks.AsyncResource( "QUASEJS" );
const ASYNC_ID_SYMBOL = Object.getOwnPropertySymbols( FAKE_RESOURCE ).find(
  s => s.toString() === "Symbol(asyncId)"
);

const actives = new Map();
const hook = asyncHooks.createHook( {
  init( asyncId, type ) {
    if ( type === "TIMERWRAP" || type === "PROMISE" ) {
      return;
    }
    actives.set( asyncId, {
      type,
      stack: getStack( 2 )
    } );
  },
  destroy( asyncId ) {
    actives.delete( asyncId );
  }
} );

export function enable() {
  hook.enable();
}

export default function() {
  hook.disable();

  const array = [];

  for ( const resource of process._getActiveHandles() ) {
    const info = actives.get( resource[ ASYNC_ID_SYMBOL ] );
    if ( info ) {
      array.push( info );
    }
  }

  for ( const resource of process._getActiveRequests() ) {
    const info = actives.get( resource[ ASYNC_ID_SYMBOL ] );
    if ( info ) {
      array.push( info );
    }
  }

  actives.clear();
  return array;
}
