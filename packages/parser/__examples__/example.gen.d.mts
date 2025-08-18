type type_$Empty = type_object;

type type_object = {
  readonly [key in string]: never
};
type type_$Position = type_object0;

type type_object0 = {
  readonly pos: type_number;
  readonly line: type_number;
  readonly column: type_number;
};
type type_number = number;
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
  readonly external: type_boolean;
  readonly $loc: type_object01;
};
type type_object0123 = {
  readonly id: type_number;
};
type type_union = (type_null | type_object01234);
type type_null = null;
type type_object01234 = {
  readonly $loc: type_object01;
};
type type_object012345 = {
  readonly ret: type_object0123456;
  readonly text: type_union0;
  readonly $loc: type_object01;
};
type type_object0123456 = {
  readonly x: type_number;
  readonly y: type_number;
};
type type_union0 = (type_string | type_null);
type type_string = string;
type type_array = readonly (type_string)[];
type type_recursive = type_object01234567;
type type_object01234567 = {
  readonly y: type_union01;
  readonly z: type_union012;
  readonly $loc: type_object01;
};
type type_union01 = (type_null | type_recursive);
type type_union012 = (type_null | type_recursive);
type type_boolean = boolean;
type type_$Externals = type_object012345678;

type type_object012345678 = {
  readonly externalCall: type_function;
};
type type_function = ((...args: type_tuple) => type_boolean);
type type_tuple = readonly [
  _arg0: type_object0123,
  _arg1: type_object012345,
];
type type_$Result = type_union0123;

type type_union0123 = (type_object0123456789 | type_object012345678910);
type type_object0123456789 = {
  readonly ok: type_literal;
  readonly asts: type_array0;
};
type type_literal = true;
type type_array0 = readonly (type_$AST)[];
type type_object012345678910 = {
  readonly ok: type_literal0;
  readonly errors: type_array01;
};
type type_literal0 = false;
type type_array01 = readonly (type_tuple0)[];
type type_tuple0 = readonly [
  _arg0: type_number,
  _arg1: type_unknown,
];
type type_unknown = unknown;

export function parse(external: type_$Externals, string: string, $arg: type_string): type_$Result;
