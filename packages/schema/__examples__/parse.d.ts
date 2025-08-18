type type_object = {
  readonly a: type_null;
  readonly b: type_number;
  readonly c: type_array;
  readonly d: type_object0;
};
type type_null = null;
type type_number = number;
type type_array = readonly (type_string)[];
type type_string = string;
type type_object0 = {
  readonly [key in type_string]: type_bigint;
};
type type_bigint = bigint;

export default type_object;
