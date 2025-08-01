import { type Position } from "./input.ts";

export function positionToString(pos: Position) {
  return `${pos.line}:${pos.column}`;
}

class ErrorWithLocation extends Error {
  public readonly originalMessage: string;
  public readonly loc: Position;

  constructor(message: string, loc: Position) {
    super(`${message} (at ${positionToString(loc)})`);
    this.originalMessage = message;
    this.loc = loc;
  }
}

export function error(message: string, loc: Position): ErrorWithLocation {
  return new ErrorWithLocation(message, loc);
}
