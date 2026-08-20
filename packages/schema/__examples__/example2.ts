import { inspect as _inspect } from "node:util";
import { expectType } from "../../util/miscellaneous";
import { builtin as t } from "../builtin-types";
import type { SchemaInput, SchemaOutput } from "../schema-type";
import type { ValidationResult } from "../util/result";

const inspect = (value: unknown) =>
  _inspect(value, { depth: 20, colors: true });

console.log(
  inspect(
    t.string
      .transform(val => val.length)
      .pipe(t.number.check(len => len < 5))
      .parse(undefined)
  )
);

console.log(
  inspect(
    t.string
      .transform(val => val.length)
      .pipe(t.number.check(len => len < 5))
      .parse("abc")
  )
);

console.log(
  inspect(
    t.string
      .transform(val => val.length)
      .pipe(t.number.check(len => false))
      .parse("undefined")
  )
);

console.log(inspect(t.union(t.number).default(0, "nullish").parse(null)));

//

type Rec = readonly Rec[] | null;
type RecO = readonly RecO[] | undefined;

t.rec<RecO, Rec>(that => {
  return t
    .union(t.array(that), t.null)
    .transform(v => (v === null ? undefined : v));
}).parse(undefined);

//

console.log(inspect(t.union(t.string, t.number).pipe(t.string).parse(10)));

//

type Str = SchemaOutput<typeof t.string>;

expectType<string, Str>();

//

const ss = Symbol();
const ll = t.literal(ss);
type LL = SchemaOutput<typeof ll>;

//

const aa = t.array(t.bigint);
type AA = SchemaOutput<typeof aa>;

expectType<readonly bigint[], AA>();

//

const tt = t.tuple([t.null], t.bigint);
type TT = SchemaOutput<typeof tt>;

expectType<readonly [null, ...bigint[]], TT>;

//

const A = t.object(
  {
    a: {
      readonly: false,
      partial: false,
      type: t.number.transform(n => n.toString()),
    },
  },
  {
    readonly: true,
    partial: true,
    key: t.string,
    value: t.number.transform(n => n.toString()),
  }
);

type A2 = SchemaOutput<typeof A>;
type A3 = SchemaInput<typeof A>;

const obj: A2 = { a: "10", b: "2" };

expectType<
  { a: string } & { readonly [key: string]: string | undefined },
  A2
>();

//

const uu = t.union(t.array(t.string), t.null);
type UU = SchemaOutput<typeof uu>;

expectType<readonly string[] | null, UU>();

//

const inter = t.inter(t.array(t.string), t.array(t.string, false));
type Inter = SchemaOutput<typeof inter>;

expectType<readonly string[] & string[], Inter>();

//

// const pp = t.promise(t.number.transform(n => n.toString()));

const funcc = t.func(
  t.tuple(
    [t.array(t.bigint), t.string.transform(s => s.length)],
    t.literal(10)
  ),
  t.array(t.string)
);

type Func = SchemaOutput<typeof funcc>;
type Func2 = SchemaInput<typeof funcc>;

expectType<
  (
    args_0: readonly bigint[],
    args_1: string,
    ...args_2: 10[]
  ) => ValidationResult<readonly string[], any>,
  Func
>();

/* expectType<
  (args_0: readonly bigint[], args_1: number, ...args_2: 10[]) => number,
  Func2
>();

const result = funcc
  .implement(async function (a, b, c) {
    console.log(a, b, c);
    this;
    return 10;
  })
  .call([""], [10n], "abc", 10);

const presult = pp.implement(resolve => {
  resolve(10);
});

const funcc2 = func(
  tuple([array(bigint), string.transform(s => s.length)], literal(10)),
  pp
);

type Func2Out = SchemaOutput<typeof funcc2>;

const result2 = funcc2.implement(async function (a, b, c) {
  console.log(a, b, c);
  this;
  return 10;
});

result2([10n], "abc", 10);

const result3 = funcc2.implement(async (a, b, c) => {
  console.log(a, b, c);
  this;
  return 10;
});

result3([10n], "abc", 10); */

//

enum ENUM {
  a,
  b,
  c,
}
const EE = t.enum(ENUM);
type ee = SchemaOutput<typeof EE>;

expectType<ENUM, ee>();

//

/* class CA {
  a: number = 10;
}

const ii = instanceOf(CA);
type II = SchemaOutput<typeof ii>;

expectType<CA, II>(); */
