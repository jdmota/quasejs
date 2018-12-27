import { BuilderContext, ModuleContext } from "../plugins/context";

export function encapsulate( value: unknown ) {
  if ( value instanceof BuilderContext ) {
    return Object.assign( { $quase_builder$: "builderCtx" }, value );
  }
  if ( value instanceof ModuleContext ) {
    return Object.assign( { $quase_builder$: "moduleCtx" }, value );
  }
  return value;
}

export function revive( value: any ) {
  if ( value != null && typeof value === "object" ) {
    if ( value.$quase_builder$ === "builderCtx" ) {
      return Object.assign( Object.create( BuilderContext.prototype ), value );
    }
    if ( value.$quase_builder$ === "moduleCtx" ) {
      return Object.assign( Object.create( ModuleContext.prototype ), value );
    }
  }
  return value;
}
