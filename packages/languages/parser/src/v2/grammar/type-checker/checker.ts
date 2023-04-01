import { AnyType, TypesRegistry } from "./types";
import { GrammarFormatter } from "../grammar-formatter";
import { Normalizer } from "./normalizer";
import { err, GrammarError } from "../grammar";

export class TypeChecker {
  private readonly registry: TypesRegistry;
  private readonly normalizer: Normalizer;
  private readonly formatter: GrammarFormatter;

  constructor(
    registry: TypesRegistry,
    normalizer: Normalizer,
    formatter: GrammarFormatter
  ) {
    this.registry = registry;
    this.normalizer = normalizer;
    this.formatter = formatter;
  }

  private format(type: AnyType) {
    return this.normalizer.normalize(type).format();
  }

  check(errors: GrammarError[]) {
    for (const [a, b, nodeA, nodeB] of this.registry.getErrors()) {
      errors.push(
        err(
          `${this.format(a)} is not a subtype of ${this.format(b)} in ${
            nodeA ? this.formatter.visit(nodeA) : null
          } and ${nodeB ? this.formatter.visit(nodeB) : null}`,
          nodeB?.loc
        )
      );
    }
  }
}
