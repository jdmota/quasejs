const freeGlobal = typeof global === "object" && global;
const freeSelf = typeof self === "object" && self;
const root = freeGlobal || freeSelf || Function("return this")();

// Returns a set with the elements in 'a' but not in 'b'
function diff(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>
): readonly string[] {
  const result = new Set(a);
  for (const bV of b) {
    result.delete(bV);
  }
  return [...result];
}

export class GlobalsSanitizer {
  private readonly initialVars: Set<string>;

  constructor(private readonly allowed: readonly string[]) {
    this.initialVars = this.getVars();
  }

  private getVars(): Set<string> {
    const vars = new Set<string>();
    for (const key in Object.keys(root)) {
      vars.add(key);
    }
    return vars;
  }

  check() {
    const old = this.initialVars;
    const errors = [];
    const vars = this.getVars();

    for (const a of this.allowed) {
      old.delete(a);
      vars.delete(a);
    }

    const newGlobals = diff(vars, old);
    if (newGlobals.length > 0) {
      errors.push("Introduced global variable(s): " + newGlobals.join(", "));
    }

    const deletedGlobals = diff(old, vars);
    if (deletedGlobals.length > 0) {
      errors.push("Deleted global variable(s): " + deletedGlobals.join(", "));
    }

    if (errors.length) {
      return errors.join("; ");
    }
  }
}
