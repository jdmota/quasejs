const nativeObject = Object;

function checkGlobal( value ) {
  return ( value && value.Object === nativeObject ) ? value : null;
}

/* global self, window */

export const freeExports = typeof exports === "object" && exports;

export const freeModule = freeExports && typeof module === "object" && module;

export const moduleExports = freeModule && freeModule.exports === freeExports;

export const freeGlobal = checkGlobal( typeof global === "object" && global );

export const freeProcess = moduleExports && freeGlobal.process;

export const isEnvNode = !!freeGlobal;

export const freeSelf = checkGlobal( typeof self === "object" && self );

export const freeWindow = checkGlobal( typeof window === "object" && window );

/* eslint no-new-func: 0 */
export const root = freeGlobal || freeSelf || Function( "return this" )();

export const hasOwn = {}.hasOwnProperty;
export const objectProto = Object.prototype;
export const nativeKeys = Object.keys;
export const nativeIsFinite = isFinite;
export const propIsEnumerable = Object.prototype.propertyIsEnumerable;
