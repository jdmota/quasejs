// @flow
import Path from "./path";
import getType from "./get-type";
import { t, types, toType, type Type, type Schema } from "./types";
import { ValidationError, checkType } from "./validation";

export function validate( schema: Schema, config: ?Object ) {
  config = config || {};
  t.object( { properties: schema } ).validate( new Path(), config, config );
}

export { apply } from "./defaults";
export { loadConfigFrom, getConfig } from "./get-config";
export { printWarning, printError } from "./print";

export { t, types, toType, getType, ValidationError, checkType };

export function extractDefaults( type: Type, dest: ?Object ) {
  return type.defaults( new Path(), dest || {} );
}
