import { AnyRule } from "./grammar-builder";
import {
  ReadonlyFieldsStore,
  getFields,
  checkAmbiguousFields,
} from "./grammar-checker";

export class Grammar {
  readonly name: string;
  readonly rules: ReadonlyMap<string, AnyRule>;
  readonly fields: ReadonlyMap<string, ReadonlyFieldsStore>;
  readonly ambiguousFields: ReadonlyMap<string, string[]>;

  constructor(name: string, rules: ReadonlyMap<string, AnyRule>) {
    const fields = Array.from(rules).map(
      ([name, rule]) => [name, getFields(rule)] as const
    );
    const ambiguousFields = fields.map(
      ([name, store]) => [name, checkAmbiguousFields(store)] as const
    );
    this.name = name;
    this.rules = rules;
    this.fields = new Map(fields);
    this.ambiguousFields = new Map(ambiguousFields);
  }
}
