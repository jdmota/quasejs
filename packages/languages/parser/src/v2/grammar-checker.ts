import {
  Rule,
  FieldRules,
  NamedRule,
  SeqRule,
  ChoiceRule,
  EmptyRule,
  EofRule,
  FieldMultipleRule,
  FieldSpreadRule,
  FieldRule,
  IdRule,
  MemberRule,
  OptionalRule,
  Repeat1Rule,
  RepeatRule,
  StringRule,
  RegExpRule,
} from "./grammar-builder";
import {
  AstType,
  AstFields,
  astTypeNull,
  makeUnion,
  mergeAstFields,
  emptyAstFields,
  getSpreadableItem,
} from "./grammar-types";

type WrappedInferredType = {
  t: InferredType;
};

type InferredType = {
  type: "to_solve";
  constraints: string[];
};

function newWrappedInferredType(): WrappedInferredType {
  return {
    t: {
      type: "to_solve",
      constraints: [],
    },
  };
}

const constraints = {
  eq(a: WrappedInferredType, b: WrappedInferredType) {
    a.t = b.t = {
      type: "to_solve",
      constraints: [...a.t.constraints, ...b.t.constraints],
    };
  },
};

export function getAstType(rule: Rule): AstType {
  switch (rule.type) {
    case "seq":
      return {
        type: "tuple",
        items: rule.rules.map(getAstType),
      };
    case "choice":
      return makeUnion(rule.rules.map(getAstType));
    case "repeat":
    case "repeat1":
      return {
        type: "array",
        item: getAstType(rule.rule),
      };
    case "optional":
      return makeUnion([getAstType(rule.rule), astTypeNull]);
    case "id":
      return {
        type: "id",
        id: rule.id,
      };
    case "member":
      return {
        type: "member",
        parent: getAstType(rule.parent),
        id: rule.id,
      };
    case "empty":
      return astTypeNull;
    case "eof":
      return {
        type: "token",
      };
    case "string":
      return {
        type: "token",
      };
    case "regexp":
      return {
        type: "token",
      };
    case "field":
    case "field_multiple":
    case "field_spread":
      return getAstType(rule.rule);
  }
}

export function getAllFields(
  rule: Rule,
  set = new Set<FieldRules>()
): Set<FieldRules> {
  switch (rule.type) {
    case "seq":
    case "choice":
      return rule.rules.reduce((acc, r) => getAllFields(r, acc), set);
    case "repeat":
    case "repeat1":
    case "optional":
      return getAllFields(rule.rule, set);
    case "id":
    case "member":
    case "empty":
    case "eof":
    case "string":
    case "regexp":
      return set;
    case "field":
    case "field_multiple":
    case "field_spread":
      set.add(rule);
      return set;
  }
}

export function getAstFields(rule: Rule, initial: AstFields): AstFields {
  switch (rule.type) {
    case "seq":
      return rule.rules.reduce((acc, r) => getAstFields(r, acc), initial);
    case "choice":
      return rule.rules.reduce(
        (acc, r) => mergeAstFields(acc, getAstFields(r, initial)),
        emptyAstFields
      );
    case "repeat":
      return mergeAstFields(emptyAstFields, getAstFields(rule.rule, initial));
    case "repeat1":
      return getAstFields(rule.rule, initial);
    case "optional":
      return mergeAstFields(emptyAstFields, getAstFields(rule.rule, initial));
    case "id":
    case "member":
    case "empty":
    case "eof":
    case "string":
    case "regexp":
      return initial;
    case "field": {
      // TODO type check
      const fields = new Map<string, AstType>(initial);
      fields.set(rule.name, getAstType(rule.rule));
      return fields;
    }
    case "field_multiple": {
      // TODO type check
      const fields = new Map<string, AstType>(initial);
      fields.set(rule.name, {
        type: "array",
        item: getAstType(rule.rule),
      });
      return fields;
    }
    case "field_spread": {
      // TODO type check
      const fields = new Map<string, AstType>(initial);
      fields.set(rule.name, {
        type: "array",
        item: getSpreadableItem(getAstType(rule.rule)),
      });
      return fields;
    }
  }
}

type Store = ReadonlyMap<string, WrappedInferredType>;

export class TypeInferrer {
  private readonly rules: ReadonlyMap<string, NamedRule>;
  private readonly fields: ReadonlyMap<NamedRule, ReadonlySet<FieldRules>>;
  private readonly fieldTypes: ReadonlyMap<NamedRule, Store>;
  private readonly types = new Map<Rule, WrappedInferredType>();

  constructor(rules: NamedRule[]) {
    this.rules = new Map(rules.map(r => [r.name, r]));
    this.fields = new Map(rules.map(r => [r, getAllFields(r.rule)]));
    this.fieldTypes = new Map(
      rules.map(r => [
        r,
        new Map(
          Array.from(getAllFields(r.rule)).map(f => [
            f.name,
            newWrappedInferredType(),
          ])
        ),
      ])
    );
  }

  analyze(rule: Rule, store: Store) {
    const type = this.types.get(rule) || newWrappedInferredType();
    this.types.set(rule, type);
    this[rule.type](rule as any, store, type);
    return type;
  }

  seq(rule: SeqRule, store: Store, type: WrappedInferredType) {
    for (const r of rule.rules) {
      this.analyze(r, store);
    }
  }

  choice(rule: ChoiceRule, store: Store, type: WrappedInferredType) {
    for (const r of rule.rules) {
      this.analyze(r, store);
    }
  }

  repeat(rule: RepeatRule, store: Store, type: WrappedInferredType) {
    this.analyze(rule.rule, store);
  }

  repeat1(rule: Repeat1Rule, store: Store, type: WrappedInferredType) {
    this.analyze(rule.rule, store);
  }

  optional(rule: OptionalRule, store: Store, type: WrappedInferredType) {
    this.analyze(rule.rule, store);
  }

  id(rule: IdRule, store: Store, type: WrappedInferredType) {}

  member(rule: MemberRule, store: Store, type: WrappedInferredType) {}

  empty(rule: EmptyRule, store: Store, type: WrappedInferredType) {}

  eof(rule: EofRule, store: Store, type: WrappedInferredType) {}

  string(rule: StringRule, store: Store, type: WrappedInferredType) {}

  regexp(rule: RegExpRule, store: Store, type: WrappedInferredType) {}

  field(rule: FieldRule, store: Store, type: WrappedInferredType) {
    const ruleType = this.analyze(rule.rule, store);
    constraints.eq(type, ruleType);
  }

  field_multiple(
    rule: FieldMultipleRule,
    store: Store,
    type: WrappedInferredType
  ) {
    const ruleType = this.analyze(rule.rule, store);
    constraints.eq(type, ruleType);
  }

  field_spread(rule: FieldSpreadRule, store: Store, type: WrappedInferredType) {
    const ruleType = this.analyze(rule.rule, store);
    constraints.eq(type, ruleType);
  }
}
