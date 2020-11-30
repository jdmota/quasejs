import { AnyRule } from "./grammar-builder";
import {
  ReadonlyFieldsStore,
  getFields,
  checkAmbiguousFields,
} from "./grammar-checker";

export class Grammar {
  readonly name: string;
  readonly rules: ReadonlyMap<string, AnyRule>;
  readonly startRule: string;
  readonly fields: ReadonlyMap<string, ReadonlyFieldsStore>;
  readonly ambiguousFields: ReadonlyMap<string, string[]>;

  constructor({
    name,
    rules,
    startRule,
  }: {
    name: string;
    rules: ReadonlyMap<string, AnyRule>;
    startRule: string;
  }) {
    const fields = Array.from(rules).map(
      ([name, rule]) => [name, getFields(rule)] as const
    );
    const ambiguousFields = fields.map(
      ([name, store]) => [name, checkAmbiguousFields(store)] as const
    );
    this.name = name;
    this.rules = rules;
    this.startRule = startRule;
    this.fields = new Map(fields);
    this.ambiguousFields = new Map(ambiguousFields);
  }

  getRule(ruleName: string) {
    const rule = this.rules.get(ruleName);
    if (rule == null) {
      throw new Error(`No rule called ${ruleName}`);
    }
    return rule;
  }
}
