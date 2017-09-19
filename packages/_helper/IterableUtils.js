import { SYMBOL } from "./symbols";

export const ITERATE_KEYS = 0;
export const ITERATE_VALUES = 1;
export const ITERATE_ENTRIES = 2;

export const DONE = Object.freeze( { value: undefined, done: true } );

export function getIterator( obj ) {
  const real = SYMBOL.iterator;
  return real ? obj[ real ]() : obj[ "@@iterator" ]();
}

export function getIteratorFn( obj ) {
  const real = SYMBOL.iterator;
  return real ? obj[ real ] : obj[ "@@iterator" ];
}

export function setIteratorFn( obj, func ) {

  const real = SYMBOL.iterator;

  if ( real ) {
    obj[ real ] = func;
  }

  obj[ "@@iterator" ] = func;
}

export function createIterableClass( clazz, IteratorFn, iteratorType ) {
  const proto = clazz.prototype;
  proto.entries = function() {
    return new IteratorFn( this, ITERATE_ENTRIES );
  };
  proto.values = function() {
    return new IteratorFn( this, ITERATE_VALUES );
  };
  proto.keys = function() {
    return new IteratorFn( this, ITERATE_KEYS );
  };
  setIteratorFn( proto, proto[ iteratorType ] );
}
