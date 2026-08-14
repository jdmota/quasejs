type type_object = {
  readonly a: null;
  readonly b: number;
  readonly c: type_array;
  readonly d: type_object0;
};
type type_array = readonly (string)[];
type type_object0 = {
  readonly [key in string]: bigint;
};

export default type_object;
