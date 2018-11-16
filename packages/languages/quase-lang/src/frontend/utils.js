// @flow
import type { Node } from "./nodes";

export function isNameDefinition( node: Node ) {
  return node.type === "Identifier" && node.idType === "definition";
}

export function isLabelDefinition( node: Node ) {
  return node.type === "Identifier" && node.idType === "labelDefinition";
}

export function isNameReference( node: Node ) {
  return node.type === "Identifier" && node.idType === "reference";
}

export function isLabelReference( node: Node ) {
  return node.type === "Identifier" && node.idType === "labelReference";
}

export function containsBindings( node: Node ) {
  return node.type === "ArrayPatten" ||
    node.type === "ObjectPattern" ||
    node.type === "RestElement" ||
    node.type === "AssignmentPattern" ||
    isNameDefinition( node );
}

export function isScope( node: Node ) {
  return node.type === "Block" ||
    node.type === "Program" ||
    node.type === "For" ||
    node.type === "FunctionExpression" ||
    node.type === "ClassExpression" ||
    node.type === "CatchClause";
}
