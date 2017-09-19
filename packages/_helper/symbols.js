import { isEnvNode } from "./consts";

export const SYMBOL_SUPPORT = typeof Symbol === "function" && !( isEnvNode && /^v0/.test( process.version ) );

export const SYMBOL = typeof Symbol === "function" ? Symbol : {};

export const getSymbol = function( name ) {
  return SYMBOL[ name ] || "@@" + name;
};

export const getBySymbol = function( obj, name ) {
  const real = SYMBOL[ name ];
  return real ? obj[ real ] : obj[ "@@" + name ];
};

export const setBySymbol = function( obj, name, value ) {

  const real = SYMBOL[ name ];

  if ( real ) {
    obj[ real ] = value;
  }

  obj[ "@@" + name ] = value;
};

export const symbolProto = SYMBOL ? SYMBOL.prototype : undefined;
export const symbolValueOf = symbolProto ? symbolProto.valueOf : undefined;
export const symbolToString = symbolProto ? symbolProto.toString : undefined;
