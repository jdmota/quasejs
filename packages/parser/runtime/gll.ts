import { MapArray } from "../../util/data-structures/map-array";
import { jsonEquals, jsonHashCode } from "../../util/json";
import { type ObjectHashEquals } from "../../util/miscellaneous";
import {
  GLLBase,
  GLLDescriptor,
  GSSNode,
  type IEnv,
  type IGLLLabel,
} from "../gll/gll-base";

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

export class GLL<AST> extends GLLBase<GLLLabel, GLLArgs, GLLEnv, GLLValue> {
  private readonly errors = new MapArray<number, unknown>();

  constructor(
    private readonly type: "rule" | "token",
    private readonly parser: {
      $createEnv: (rule: string, args: readonly unknown[]) => EnvObj;
      $jump: (pos: number) => void;
    },
    private readonly initialRule: string,
    private readonly args: readonly unknown[],
    pos: number = 0
  ) {
    super(
      new GLLLabel(initialRule, 0),
      new GLLArgs(args),
      new GLLEnv(parser.$createEnv(initialRule, args))
    );
    this.addInitial(pos);
  }

  fork(pos: number): GLL<AST> {
    return new GLL(this.type, this.parser, this.initialRule, this.args, pos);
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
    const { pos } = this;
    this.parser.$jump(pos);
    const method = labelToStr(this.type, desc.label);
    const parser = this.parser as any;
    try {
      parser[method]({ ...desc.env.obj });
    } catch (err) {
      this.errors.add(pos, err);
    }
  }

  private readonly asts: (readonly [number, AST])[] = [];

  override onPop(
    node: GSSNode<GLLLabel, GLLArgs, GLLEnv>,
    pos: number,
    retValue: GLLValue
  ) {
    if (node.rule === this.initialRule) {
      this.asts.push([pos, retValue.value as AST] as const);
    }
  }

  parse() {
    this.run();
    if (this.asts.length === 0) {
      return { ok: false, errors: Array.from(this.errors) } as const;
    }
    return {
      ok: true,
      asts: this.asts.map(r => r[1]),
      _asts: this.asts,
    } as const;
  }
}

export function labelToStr(
  type: "rule" | "token",
  label: Readonly<{ rule: string; label: number }>
) {
  return `${type}${label.rule}_${label.label}`;
}
