import { AnyType, isSubtype, TypesRegistry } from "./types";
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

  private formatLower(type: AnyType) {
    return this.normalizer.lower.normalize(type).format();
  }

  private formatUpper(type: AnyType) {
    return this.normalizer.upper.normalize(type).format();
  }

  check(errors: GrammarError[]) {
    for (const [a, b, nodeA, nodeB] of this.registry.getChecks()) {
      if (!isSubtype(a, b, this.registry)) {
        errors.push(
          err(
            `${this.formatLower(a)} is not a subtype of ${this.formatUpper(
              b
            )} in ${nodeA ? this.formatter.visit(nodeA) : null} and ${
              nodeB ? this.formatter.visit(nodeB) : null
            }`,
            nodeB?.loc
          )
        );
      }
    }
  }
}
