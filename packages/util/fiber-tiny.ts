export type TinyTaskCtx = Readonly<{
  active: boolean;
}>;

export type TinyTask<A> = Readonly<{
  promise: Promise<A>;
  abort: () => void;
}>;

export function tinyTask<A>(fn: (ctx: TinyTaskCtx) => Promise<A>): TinyTask<A> {
  const ctx = { active: true };
  const promise = fn(ctx);
  return {
    promise,
    abort: () => {
      ctx.active = false;
    },
  };
}
