type SchemaError = Readonly<{ code: string; message: string; }>;
type SchemaErrorTree = Readonly<{ errors: readonly SchemaError[]; }>;
type SchemaCircularReference = Readonly<{ code: "circular"; message: string; }>;
type SchemaInvalidType = Readonly<{ code: "invalid_type"; message: string; }>;
type SchemaForbiddenKey = Readonly<{ code: "forbidden_key"; message: string; }>;
type SchemaExtraneousKeys = Readonly<{ code: "extraneous_keys"; message: string; }>;
type SchemaObjectError = SchemaCircularReference | SchemaInvalidType | SchemaForbiddenKey | SchemaExtraneousKeys;
type SchemaInvalidKey<K> = Readonly<{ code: "invalid_key"; key: unknown; errors: K; }>;
type SchemaRecordError<K> = SchemaCircularReference | SchemaInvalidType | SchemaForbiddenKey | SchemaExtraneousKeys | SchemaInvalidKey<K>;
type SchemaFunctionError<A, R> = Readonly<{ code: "function_error"; where: "arguments"; errors: A; }> | Readonly<{ code: "function_error"; where: "result"; errors: R; }>;
type type_object = {
  readonly a: null;
  readonly b: number;
  readonly c: type_array;
  readonly d: type_object0;
  readonly e: type_tuple;
  readonly f: type_record;
  readonly g: type_function;
};
type type_object$error = Readonly<{
  errors: readonly SchemaObjectError[];
  properties?: Readonly<{
    a?: SchemaErrorTree | undefined;
    b?: SchemaErrorTree | undefined;
    c?: type_array$error | undefined;
    d?: type_object0$error | undefined;
    e?: type_tuple$error | undefined;
    f?: type_record$error | undefined;
    g?: type_function$error | undefined;
  }>;
}>;
type type_null$error = SchemaErrorTree;
type type_number$error = SchemaErrorTree;
type type_array = readonly (string)[];
type type_array$error = Readonly<{ errors: readonly SchemaError[]; items?: readonly (SchemaErrorTree | undefined)[] }>;
type type_string$error = SchemaErrorTree;
type type_object0 = {
  readonly [key in string]: bigint;
};
type type_object0$error = Readonly<{
  errors: readonly SchemaObjectError[];
  properties?: Readonly<{
    [key in string]?: SchemaErrorTree;
  }>;
}>;
type type_bigint$error = SchemaErrorTree;
type type_tuple = readonly [
  _arg0: bigint,
  _arg1: boolean,
  _arg2: null,
  ..._arg3: type_literal[],
];
type type_tuple$error = Readonly<{
  errors: readonly SchemaError[];
  items?: readonly [
    _arg0: (SchemaErrorTree | undefined),
    _arg1: (SchemaErrorTree | undefined),
    _arg2: (SchemaErrorTree | undefined),
    ..._arg3: (type_literal$error | undefined)[],
  ];
}>;
type type_boolean$error = SchemaErrorTree;
type type_literal = "abc";
type type_literal$error = SchemaErrorTree;
type type_record = Readonly<{[key in number]?: string}>;
type type_record$error = Readonly<{
  errors: readonly SchemaRecordError<number>[];
  properties?: Readonly<{
    [key in number]?: SchemaErrorTree;
  }>;
}>;
type type_function = ((...args: type_tuple0) => boolean);
type type_function$error = Readonly<{
  errors: readonly SchemaFunctionError<type_tuple0$error, SchemaErrorTree>[];
}>;
type type_tuple0 = readonly [
  _arg0: null,
  _arg1: undefined,
  _arg2: string,
];
type type_tuple0$error = Readonly<{
  errors: readonly SchemaError[];
  items?: readonly [
    _arg0: (SchemaErrorTree | undefined),
    _arg1: (SchemaErrorTree | undefined),
    _arg2: (SchemaErrorTree | undefined),
  ];
}>;
type type_undefined$error = SchemaErrorTree;

export default type_object;
