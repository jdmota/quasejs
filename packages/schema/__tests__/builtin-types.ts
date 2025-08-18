import { expect, it } from "@jest/globals";
import { builtin as t } from "../builtin-types";

it("recursive", () => {
  expect(() => {
    t.rec(X => X);
  }).toThrow("Recursive type circularly references itself");

  expect(() => {
    t.rec(X => t.tuple([X]));
  }).not.toThrow();

  expect(() => {
    t.rec(X => t.rec(Y => X));
  }).toThrow("Recursive type circularly references itself");

  expect(() => {
    t.rec(X => t.tuple([t.rec(Y => X)]));
  }).not.toThrow();

  expect(() => {
    t.rec(X => t.rec(Y => t.union(X, Y)));
  }).toThrow("Recursive type circularly references itself");

  expect(() => {
    t.rec(X => t.rec(Y => t.inter(X, Y)));
  }).toThrow("Recursive type circularly references itself");

  expect(() => {
    t.rec(X => t.union(t.rec(Y => X)));
  }).toThrow("Recursive type circularly references itself");

  expect(() => {
    t.rec(X => t.inter(t.rec(Y => X)));
  }).toThrow("Recursive type circularly references itself");
});
