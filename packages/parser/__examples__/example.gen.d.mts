type ObjectKey = string | number | symbol;
type type_$Empty = type_object;
type type_object = {
  readonly [key in ObjectKey]: never
};
type type_$Position = type_object0;
type type_object0 = {
  readonly pos: number;
  readonly line: number;
  readonly column: number;
};
type type_$Location = type_object01;
type type_object01 = {
  readonly start: type_object0;
  readonly end: type_object0;
};
type type_$AST = type_object012;
type type_object012 = {
  readonly o: type_object0123;
  readonly b: type_union;
  readonly c: type_object012345;
  readonly d: type_array;
  readonly t: type_recursive;
  readonly external: boolean;
  readonly $loc: type_object01;
};
type type_object0123 = {
  readonly id: number;
};
type type_union = (null | type_object01234);
type type_object01234 = {
  readonly $loc: type_object01;
};
type type_object012345 = {
  readonly ret: type_object0123456;
  readonly text: type_union0;
  readonly $loc: type_object01;
};
type type_object0123456 = {
  readonly x: number;
  readonly y: number;
};
type type_union0 = (string | null);
type type_array = readonly (string)[];
type type_recursive = type_object01234567;
type type_object01234567 = {
  readonly y: type_union01;
  readonly z: type_union012;
  readonly $loc: type_object01;
};
type type_union01 = (null | type_recursive);
type type_union012 = (null | type_recursive);
type type_$Externals = type_object012345678;
type type_object012345678 = {
  readonly externalCall: type_function;
};
type type_function = ((...args: type_tuple) => boolean);
type type_tuple = readonly [
  _arg0: type_object0123,
  _arg1: type_object012345,
];
type type_$Result = type_union0123;
type type_union0123 = (type_object0123456789 | type_object012345678910);
type type_object0123456789 = {
  readonly ok: true;
  readonly asts: type_array0;
};
type type_array0 = readonly (type_$AST)[];
type type_object012345678910 = {
  readonly ok: false;
  readonly errors: type_array01;
};
type type_array01 = readonly (type_tuple0)[];
type type_tuple0 = readonly [
  _arg0: number,
  _arg1: unknown,
];

export function parse(external: type_$Externals, string: string, $arg: string): type_$Result;
