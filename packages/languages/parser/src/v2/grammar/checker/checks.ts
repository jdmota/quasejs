import { AnyType, isSubtype, TypesRegistry } from "./types";
import { printLoc } from "../../utils";
import { GrammarFormatter } from "../grammar-formatter";
import { Normalizer } from "./normalize";

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

  private normalize(type: AnyType) {
    return this.normalizer.normalize(type).toTypescript();
  }

  check() {
    for (const [a, b, node] of this.registry.getChecks()) {
      if (!isSubtype(a, b, this.registry)) {
        console.log(
          this.normalize(a),
          "is not a subtype of",
          this.normalize(b),
          "in",
          node ? this.formatter.visit(node) : null
        );
      }
    }
  }
}
