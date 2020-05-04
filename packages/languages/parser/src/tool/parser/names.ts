import { printLoc } from "../utils";
import { Node, Named } from ".";

export class Names {
  arrays: Set<string>;
  optionals: Set<string>;
  names: Map<string, Named[]>;
  nodes: Named[];

  constructor() {
    this.arrays = new Set();
    this.optionals = new Set();
    this.names = new Map();
    this.nodes = [];
  }

  // True if already existed
  addNamed(node: Named) {
    this.nodes.push(node);

    const names = this.names.get(node.name);
    if (names) {
      if (this.arrays.has(node.name) !== node.multiple) {
        throw new Error(
          `${node.name} is an array or a single value? (${printLoc(
            names[0]
          )} and ${printLoc(node)})`
        );
      }
      names.push(node);
      return true;
    }
    this.names.set(node.name, [node]);
    if (node.multiple) {
      this.arrays.add(node.name);
    }
    return false;
  }

  markAllOptional() {
    for (const name of this.names.keys()) {
      this.optionals.add(name);
    }
  }

  importFromConcat(names: Names) {
    for (const node of names.nodes) {
      if (this.addNamed(node)) {
        if (!names.optionals.has(node.name)) {
          this.optionals.delete(node.name);
        }
      } else {
        if (names.optionals.has(node.name)) {
          this.optionals.add(node.name);
        }
      }
    }
  }

  importFromOptions(names: Names) {
    for (const node of names.nodes) {
      this.addNamed(node);
      if (names.optionals.has(node.name)) {
        this.optionals.add(node.name);
      }
    }
  }
}

export function connectAstNodes(
  node: Node,
  parent: Node | null,
  nextSibling: Node | null
): Names {
  let names;

  switch (node.type) {
    case "LexerRule":
      names = connectAstNodes(node.rule, node, null);
      break;
    case "ParserRule":
      names = connectAstNodes(node.rule, node, null);
      break;
    case "Options": {
      names = new Names();
      const namesCount: { [key: string]: number } = {};
      for (const opt of node.options) {
        const thisNames = connectAstNodes(opt, node, nextSibling);
        for (const name of thisNames.names.keys()) {
          namesCount[name] = namesCount[name] || 0;
          namesCount[name]++;
        }
        names.importFromOptions(thisNames);
      }
      for (const name in namesCount) {
        if (namesCount[name] < node.options.length) {
          names.optionals.add(name);
        }
      }
      break;
    }
    case "Concat": {
      names = new Names();
      const lastIndex = node.body.length - 1;
      for (let i = 0; i < lastIndex; i++) {
        names.importFromConcat(
          connectAstNodes(node.body[i], node, node.body[i + 1])
        );
      }
      names.importFromConcat(
        connectAstNodes(node.body[lastIndex], node, nextSibling)
      );
      break;
    }
    case "Optional":
    case "ZeroOrMore":
      names = connectAstNodes(node.item, node, nextSibling);
      names.markAllOptional();
      break;
    case "OneOrMore":
      names = connectAstNodes(node.item, node, nextSibling);
      break;
    case "Action":
    case "Id":
    case "String":
    case "Regexp":
    case "Empty":
    case "Dot":
      names = new Names();
      break;
    case "Named": {
      if (node.name === "type" || node.name === "loc") {
        throw new Error(
          `Cannot have named parameter called '${node.name}' (${printLoc(
            node
          )})`
        );
      }
      names = new Names();
      names.addNamed(node);
      connectAstNodes(node.item, node, nextSibling);
      break;
    }
    default:
      throw new Error(`Unexpected node: ${node.type}`);
  }
  node.parent = parent;
  node.nextSibling = nextSibling;
  return names;
}
