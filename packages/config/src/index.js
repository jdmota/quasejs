// @flow
import { t, types, type Schema } from "./types";
import { ValidationError, checkType } from "./validation";
import getType from "./get-type";

export function validate( schema: Schema, config: ?Object ) {
  config = config || {};
  t.object( schema ).validate( [], config, {}, config );
}

export { applyDefaults } from "./defaults";
export { getConfig } from "./get-config";
export { printWarning, printError } from "./print";

export { t, types, getType, ValidationError, checkType };
