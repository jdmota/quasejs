// @flow
import { t, types, type Schema } from "./types";
import { validateType, ValidationError, checkType } from "./validation";
import getType from "./get-type";

export function validate( schema: Schema, config: ?Object ) {
  validateType( [], config || {}, t.object( schema ) );
}

export { applyDefaults } from "./defaults";
export { getConfig } from "./get-config";
export { printWarning, printError } from "./print";

export { t, types, getType, ValidationError, checkType };
