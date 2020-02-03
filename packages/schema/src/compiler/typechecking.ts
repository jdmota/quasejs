import { Type, WithScope } from "./common";
import TYPES from "./types";

export function isBoolean(node: Type, ctx: WithScope): boolean {
  if (node.type === "Union") {
    return isBoolean(node.type1, ctx) && isBoolean(node.type2, ctx);
  }
  if (node.type === "Identifier") {
    if (TYPES.has(node.name)) {
      return node.name === "boolean";
    }
    return isBoolean(ctx.scope.find(node), ctx);
  }
  if (node.type === "TypeDeclaration" && node.init) {
    return isBoolean(node.init, ctx);
  }
  return node.type === "Boolean";
}

export function isNumber(node: Type, ctx: WithScope): boolean {
  if (node.type === "Union") {
    return isNumber(node.type1, ctx) && isNumber(node.type2, ctx);
  }
  if (node.type === "Identifier") {
    if (TYPES.has(node.name)) {
      return node.name === "number";
    }
    return isNumber(ctx.scope.find(node), ctx);
  }
  if (node.type === "TypeDeclaration" && node.init) {
    return isNumber(node.init, ctx);
  }
  return node.type === "Number";
}

export function isOptional(node: Type, ctx: WithScope): boolean {
  if (node.type === "Union") {
    return isOptional(node.type1, ctx) || isOptional(node.type2, ctx);
  }
  if (node.type === "Identifier") {
    if (TYPES.has(node.name)) {
      return node.name === "any" || node.name === "undefined";
    }
    return isOptional(ctx.scope.find(node), ctx);
  }
  if (node.type === "TypeDeclaration" && node.init) {
    return isOptional(node.init, ctx);
  }
  return node.type === "Optional";
}
