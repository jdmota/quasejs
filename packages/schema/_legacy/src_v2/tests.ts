import { expectType } from "../../../util/miscellaneous";
import { type SchemaInput, type SchemaOutput, SchemaType } from "./schema";
import { dateTime } from "./types/datetime";
import {
  string,
  number,
  instanceOf,
  enumeration,
  func,
  tuple,
  array,
  bigint,
  literal,
  promise,
  intersection,
  union,
  nullT,
  object,
  undefinedT,
  recursive,
} from "./types/js-types";
import { ValidationResult } from "./util/result";

console.log(
  string
    .transform(val => val.length)
    .pipe(number.refine(len => len > 5))
    .default(-1)
    .parse(undefined)
);

console.log(
  string
    .transform(val => val.length)
    .pipe(number.refine(len => len > 5))
    .default(-1)
    .parse(undefined)
);

console.log(
  string
    .transform(val => val.length)
    .pipe(number.refine(len => false))
    .default(-1)
    .parse("undefined")
);

console.log(
  union([number, undefinedT, nullT]).default(0, "nullish").parse(undefined)
);

//

type Rec = readonly Rec[] | null;
type RecO = readonly RecO[] | undefined;

recursive<RecO, Rec>(that => {
  return union([array(that), nullT]).transform(v =>
    v === null ? undefined : v
  );
}).parse(undefined);

//

console.log(dateTime(""));

//

console.log(union([string, number]).pipe(string).parse(10));

//

type Str = SchemaOutput<typeof string>;

expectType<string, Str>();

//

const ss = Symbol();
const ll = literal(ss);
type LL = SchemaOutput<typeof ll>;

//

const aa = array(bigint);
type AA = SchemaOutput<typeof aa>;

expectType<readonly bigint[], AA>();

//

const tt = tuple([nullT], bigint);
type TT = SchemaOutput<typeof tt>;

expectType<readonly [null, ...bigint[]], TT>;

//

const A = object(
  {
    a: {
      readonly: false,
      partial: false,
      type: number.transform(n => n.toString()),
    },
  },
  {
    readonly: true,
    partial: true,
    key: string,
    value: number.transform(n => n.toString()),
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

const uu = union([array(string), nullT]);
type UU = SchemaOutput<typeof uu>;

expectType<readonly string[] | null, UU>();

//

const inter = intersection(array(string), array(string, false));
type Inter = SchemaOutput<typeof inter>;

expectType<readonly string[] & string[], Inter>();

//

const pp = promise(number.transform(n => n.toString()));

const funcc = func(
  tuple([array(bigint), string.transform(s => s.length)], literal(10)),
  pp,
  array(string)
);

type Func = SchemaOutput<typeof funcc>;
type Func2 = SchemaInput<typeof funcc>;

expectType<
  (
    args_0: readonly bigint[],
    args_1: string,
    ...args_2: 10[]
  ) => ValidationResult<Promise<ValidationResult<string>>>,
  Func
>();

expectType<
  (
    args_0: readonly bigint[],
    args_1: number,
    ...args_2: 10[]
  ) => Promise<number>,
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

result3([10n], "abc", 10);

//

enum ENUM {
  a,
  b,
  c,
}
const EE = enumeration(ENUM);
type ee = SchemaOutput<typeof EE>;

expectType<ENUM, ee>();

//

class CA {
  a: number = 10;
}

const ii = instanceOf(CA);
type II = SchemaOutput<typeof ii>;

expectType<CA, II>();
