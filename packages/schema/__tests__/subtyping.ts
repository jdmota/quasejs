import { expect, it } from "@jest/globals";
import { builtin as t } from "../builtin-types";
import { isSub } from "../subtyping";

it("subtyping", () => {
  expect(isSub(t.never, t.never)).toBe(true);
  expect(isSub(t.unknown, t.unknown)).toBe(true);
  expect(isSub(t.never, t.null)).toBe(true);
  expect(isSub(t.null, t.unknown)).toBe(true);
  expect(isSub(t.null, t.null)).toBe(true);

  expect(isSub(t.null, t.never)).toBe(false);
  expect(isSub(t.unknown, t.null)).toBe(false);

  expect(isSub(t.object({}), t.object({}))).toBe(true);
  expect(isSub(t.object({ a: t.boolean }), t.object({ a: t.boolean }))).toBe(
    true
  );
  expect(
    isSub(
      t.object({ a: { readonly: false, type: t.boolean } }),
      t.object({ a: t.boolean })
    )
  ).toBe(true);
  expect(
    isSub(
      t.object({ a: t.boolean }),
      t.object({ a: { readonly: false, type: t.boolean } })
    )
  ).toBe(false);
  expect(
    isSub(t.object({ a: t.boolean, b: t.boolean }), t.object({ a: t.boolean }))
  ).toBe(false);
  expect(isSub(t.object({}), t.object({ a: t.boolean }))).toBe(false);
  expect(
    isSub(
      t.object({ a: t.boolean, b: t.boolean }, false),
      t.object({ a: t.boolean }, false)
    )
  ).toBe(true);

  expect(isSub(t.boolean, t.union(t.unknown, t.bigint))).toBe(true);
  expect(isSub(t.boolean, t.union(t.boolean, t.bigint))).toBe(true);
  expect(isSub(t.boolean, t.union(t.null, t.bigint))).toBe(false);

  expect(isSub(t.union(t.boolean, t.boolean), t.boolean)).toBe(true);
  expect(isSub(t.union(t.unknown, t.bigint), t.boolean)).toBe(false);

  expect(isSub(t.boolean, t.inter(t.unknown, t.boolean))).toBe(true);
  expect(isSub(t.boolean, t.inter(t.never, t.boolean))).toBe(false);
  expect(isSub(t.boolean, t.inter(t.unknown, t.bigint))).toBe(false);
  expect(isSub(t.boolean, t.inter(t.boolean, t.boolean))).toBe(true);
  expect(isSub(t.boolean, t.inter(t.boolean, t.bigint))).toBe(false);

  expect(isSub(t.inter(t.unknown, t.boolean), t.boolean)).toBe(true);
  expect(isSub(t.inter(t.never, t.boolean), t.boolean)).toBe(true);
  expect(isSub(t.inter(t.unknown, t.bigint), t.boolean)).toBe(false);
  expect(isSub(t.inter(t.boolean, t.boolean), t.boolean)).toBe(true);
  expect(isSub(t.inter(t.boolean, t.bigint), t.boolean)).toBe(true);

  expect(isSub(t.object({ a: t.boolean }), t.object({ b: t.boolean }))).toBe(
    false
  );

  expect(
    isSub(
      t.union(t.object({ a: t.boolean }), t.null),
      t.union(t.object({ b: t.boolean }), t.null)
    )
  ).toBe(false);

  expect(isSub(t.rec(null), t.rec(null))).toBe(false);
  expect(
    isSub(
      t.rec(X => t.tuple([X])),
      t.rec(X => t.tuple([X]))
    )
  ).toBe(true);
  expect(
    isSub(
      t.rec(X => t.tuple([t.rec(Y => t.tuple([X]))])),
      t.rec(X => t.tuple([t.rec(Y => t.tuple([X]))]))
    )
  ).toBe(true);
  expect(
    isSub(
      t.rec(X => t.tuple([t.rec(Y => t.tuple([Y]))])),
      t.rec(X => t.tuple([t.rec(Y => t.tuple([Y]))]))
    )
  ).toBe(true);
  expect(
    isSub(
      t.rec(X => t.tuple([t.rec(Y => t.tuple([X]))])),
      t.rec(X => t.tuple([t.rec(Y => t.tuple([Y]))]))
    )
  ).toBe(true);
  expect(
    isSub(
      t.rec(X => t.union(t.object({ a: X }), t.null)),
      t.rec(X => t.union(t.object({ a: X }), t.null))
    )
  ).toBe(true);
  expect(
    isSub(
      t.rec(X => t.union(t.object({ a: X }), t.null)),
      t.rec(X => t.union(t.null, t.object({ a: X })))
    )
  ).toBe(true);
  expect(
    isSub(
      t.rec(X => t.union(t.object({ a: X }), t.null)),
      t.rec(X => t.union(t.object({ b: X }), t.null))
    )
  ).toBe(false);
});
