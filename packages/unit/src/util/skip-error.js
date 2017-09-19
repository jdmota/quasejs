import { getStack } from "../../../error/src";

export default class SkipError extends Error {

  constructor( message ) {
    super( message );
    this.name = "SkipError";
    this.message = message;
    this.stack = getStack();
  }

}
