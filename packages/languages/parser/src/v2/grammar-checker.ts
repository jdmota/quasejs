import {
  Rule,
  FieldRules,
  NamedRule,
  SeqRule,
  ChoiceRule,
  EmptyRule,
  EofRule,
  FieldMultipleRule,
  FieldRule,
  IdRule,
  OptionalRule,
  Repeat1Rule,
  RepeatRule,
  StringRule,
  RegExpRule,
} from "./grammar-builder";

class Fields {
  private readonly fields;

  constructor() {
    this.fields = new Map<
      string,
      {
        name: string;
        fields: FieldRules[];
        optional: boolean;
      }
    >();
  }

  isOptional(name: string): boolean {
    const f = this.fields.get(name);
    return f ? f.optional : true;
  }

  set(name: string, fields: readonly FieldRules[], optional: boolean) {
    const current = this.fields.get(name);
    if (current == null) {
      this.fields.set(name, {
        name,
        fields: [...fields],
        optional,
      });
    } else {
      for (const f of fields) {
        current.fields.push(f);
      }
      current.optional = optional;
    }
  }

  markAllOptional() {
    for (const f of this.fields.values()) {
      f.optional = true;
    }
  }

  importFrom(store: Fields) {
    for (const { name, fields, optional } of store) {
      this.set(name, fields, optional);
    }
  }

  [Symbol.iterator](): IterableIterator<{
    readonly name: string;
    readonly fields: readonly FieldRules[];
    readonly optional: boolean;
  }> {
    return this.fields.values();
  }
}

export function getFields(rule: Rule): Fields {
  switch (rule.type) {
    case "seq": {
      const store = new Fields();
      for (const r of rule.rules) {
        for (const { name, fields, optional } of getFields(r)) {
          store.set(name, fields, optional && store.isOptional(name));
        }
      }
      return store;
    }
    case "choice": {
      const store = new Fields();
      const counts: { [key: string]: number } = {};
      for (const r of rule.rules) {
        for (const { name, fields, optional } of getFields(r)) {
          store.set(name, fields, optional);
          counts[name] = (counts[name] || 0) + 1;
        }
      }
      for (const [name, count] of Object.entries(counts)) {
        if (count < rule.rules.length) {
          // If fields appear in some alternatives and not others,
          // the field is optional
          store.set(name, [], true);
        }
      }
      return store;
    }
    case "optional":
    case "repeat": {
      const store = new Fields();
      store.importFrom(getFields(rule.rule));
      store.markAllOptional();
      return store;
    }
    case "repeat1": {
      const store = new Fields();
      store.importFrom(getFields(rule.rule));
      return store;
    }
    case "id":
    case "empty":
    case "eof":
    case "string":
    case "regexp":
      return new Fields();
    case "field":
    case "field_multiple": {
      const store = new Fields();
      store.set(rule.name, [rule], false);
      return store;
    }
  }
}
