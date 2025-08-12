// A compilable function stores a function,
// and provides with it its location and async info
// The location cannot be statically verified
// but the async info can (as is)

export type FuncLoc = Readonly<{ file: string; exportKey: string }>;

export type CompilableFun<A extends unknown[], R> = FuncLoc &
  Readonly<{
    fun: (...args: A) => R;
    async: Promise<any> extends R ? true : false;
  }>;

export type ExtractFun<T> =
  T extends CompilableFun<infer A, infer R> ? (...args: A) => R : never;

export type CompilableOrNotFun<A extends unknown[], R> =
  | CompilableFun<A, R>
  | ((...args: A) => R);

export type CompiledFunResult = Readonly<{
  funExpr: string;
  import: Readonly<{
    key: string;
    as: string;
    from: string;
  }> | null;
}>;

export function makeCompilableFun<A extends unknown[], R>(
  fun: (...args: A) => R,
  file: string,
  exportKey: string,
  async: Promise<any> extends R ? true : false
): CompilableFun<A, R> {
  return { fun, file, exportKey, async };
}

export function getFunc<A extends unknown[], R>(
  fun: CompilableOrNotFun<A, R>
): (...args: A) => R {
  return typeof fun === "function" ? fun : fun.fun;
}

export function compileFunc(
  fun: CompilableOrNotFun<unknown[], unknown>,
  newId: () => string
): CompiledFunResult {
  if (typeof fun === "function") {
    return {
      funExpr: `(${fun.toString()})`,
      import: null,
    };
  }
  const id = newId();
  return {
    funExpr: id,
    import: {
      key: fun.exportKey,
      as: id,
      from: fun.file,
    },
  };
}
