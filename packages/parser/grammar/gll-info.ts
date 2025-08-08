import { setAdd } from "../../util/maps-sets";
import type { AugmentedDeclaration } from "./grammar";

export class GLLInfo {
  private readonly parser = {
    needsGLL: new Set<string>(), // Rules that use GLL
    usesFollow: false, // If follow was used
  };

  private readonly tok = {
    needsGLL: new Set<string>(),
    usesFollow: false,
  };

  needsGLLByName(name: string) {
    // Fine because rule names and token names do not intersect
    return this.parser.needsGLL.has(name) || this.tok.needsGLL.has(name);
  }

  needsGLL(rule: AugmentedDeclaration) {
    if (rule.type === "rule") {
      return this.parser.needsGLL.has(rule.name);
    }
    return this.tok.needsGLL.has(rule.name);
  }

  markNeedsGLL(rule: AugmentedDeclaration) {
    if (rule.type === "rule") {
      return setAdd(this.parser.needsGLL, rule.name);
    }
    return setAdd(this.tok.needsGLL, rule.name);
  }

  parserUsesGLL() {
    return this.parser.needsGLL.size > 0;
  }

  tokUsesGLL() {
    return this.tok.needsGLL.size > 0;
  }

  canUseFollow(rule: AugmentedDeclaration) {
    if (rule.type === "rule") {
      return !this.parserUsesGLL();
    }
    return !this.tokUsesGLL();
  }

  markUsesFollow(rule: AugmentedDeclaration) {
    if (rule.type === "rule") {
      this.parser.usesFollow = true;
    } else {
      this.tok.usesFollow = true;
    }
  }

  shouldUseFollow(rule: AugmentedDeclaration) {
    if (rule.type === "rule") {
      return !this.parserUsesGLL() && this.parser.usesFollow;
    }
    return !this.tokUsesGLL() && this.tok.usesFollow;
  }
}
