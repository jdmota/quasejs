import { jsonEquals, jsonHashCode } from "../../util/json";
import { type ObjectHashEquals } from "../../util/miscellaneous";
import {
  GLLBase,
  GLLDescriptor,
  type IEnv,
  type IGLLLabel,
} from "../gll/gll-base";
import { INTERNAL_START_RULE } from "../grammar/grammar";

class GLLLabel implements IGLLLabel {
  constructor(
    readonly rule: string,
    readonly label: number
  ) {}
  getRule(): string {
    return this.rule;
  }
  hashCode(): number {
    return this.rule.length * this.label;
  }
  equals(other: unknown): boolean {
    return (
      other instanceof GLLLabel &&
      this.rule === other.rule &&
      this.label === other.label
    );
  }
}

class GLLArgs implements ObjectHashEquals {
  static EMPTY = new GLLArgs([]);
  constructor(readonly args: readonly unknown[]) {}
  hashCode(): number {
    return jsonHashCode(this.args);
  }
  equals(other: unknown): boolean {
    return other instanceof GLLArgs && jsonEquals(this.args, other.args);
  }
}

type EnvObj = { readonly [key: string]: unknown };

class GLLEnv implements IEnv<GLLEnv> {
  static EMPTY = new GLLEnv({});
  constructor(readonly obj: EnvObj) {}
  assign(key: string, value: unknown): GLLEnv {
    return new GLLEnv({ ...this.obj, [key]: value });
  }
  hashCode(): number {
    return jsonHashCode(this.obj);
  }
  equals(other: unknown): boolean {
    return other instanceof GLLEnv && jsonEquals(this.obj, other.obj);
  }
}

class GLLValue implements ObjectHashEquals {
  constructor(readonly value: unknown) {}
  hashCode(): number {
    return jsonHashCode(this.value);
  }
  equals(other: unknown): boolean {
    return other instanceof GLLValue && jsonEquals(this.value, other.value);
  }
}

export class GLL extends GLLBase<GLLLabel, GLLArgs, GLLEnv, GLLValue> {
  constructor(
    private readonly type: "rule" | "token",
    private readonly parser: {
      $createEnv: (rule: string, args: readonly unknown[]) => EnvObj;
      $jump: (pos: number) => void;
    },
    rule: string,
    args: readonly unknown[]
  ) {
    super(
      new GLLLabel(rule, 0),
      new GLLArgs(args),
      new GLLEnv(parser.$createEnv(rule, args))
    );
    this.addInitial(0);
  }

  protected override createEnv(rule: string, args: GLLArgs): GLLEnv {
    return new GLLEnv(this.parser.$createEnv(rule, args.args));
  }

  // Sync the internal state of the GLL algorithm
  public u(pos: number, env: EnvObj) {
    this.pos = pos;
    this.currEnv = new GLLEnv(env);
  }

  public a(rule: string, label: number, env: EnvObj) {
    this.add(new GLLLabel(rule, label), this.curr, this.pos, new GLLEnv(env));
  }

  public c(
    retRule: string,
    retLabel: number,
    rule: string,
    args: readonly unknown[]
  ) {
    return this.create(
      new GLLLabel(retRule, retLabel),
      new GLLLabel(rule, 0),
      new GLLArgs(args)
    );
  }

  public p(retValue: unknown) {
    return this.pop(new GLLValue(retValue));
  }

  override goto(desc: GLLDescriptor<GLLLabel, GLLArgs, GLLEnv>): void {
    this.parser.$jump(this.pos);
    const method = labelToStr(this.type, desc.label);
    const parser = this.parser as any;
    try {
      parser[method]({ ...desc.env.obj });
    } catch (err) {
      // Ignore
      // console.log("Error", err);
    }
  }

  override run(): readonly unknown[] {
    super.run();
    const asts = [];
    for (const [node, results] of this.pSet) {
      if (node.rule === INTERNAL_START_RULE) {
        for (const result of results) {
          asts.push(result.retValue.value);
        }
      }
    }
    return asts;
  }
}

export function labelToStr(
  type: "rule" | "token",
  label: Readonly<{ rule: string; label: number }>
) {
  return `${type}${label.rule}_${label.label}`;
}
