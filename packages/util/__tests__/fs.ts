import { expect, it } from "@jest/globals";
import { resolve } from "node:path";
import { findUp, isFile, readFileString } from "../fs";
import { prettify } from "../path-url";

const fixtures = resolve(import.meta.dirname, "__fixtures__");

it("readFileString", async () => {
  expect(readFileString(resolve(fixtures, "a.txt"))).resolves.toBe("a");
  expect(readFileString(resolve(fixtures, "empty.txt"))).resolves.toBe("");
  expect(readFileString(resolve(fixtures, "non-existant"))).resolves.toBe("");
});

it("isFile", async () => {
  expect(isFile(import.meta.filename, true)).resolves.toBe(true);
  expect(isFile(resolve(fixtures, "a.txt"), true)).resolves.toBe(true);
  expect(isFile(resolve(fixtures, "non-existant"), true)).resolves.toBe(false);
});

it("findUp", async () => {
  expect(
    (
      await findUp(["a.txt", "b.txt", "c.txt"], {
        cwd: fixtures,
      })
    ).map(p => prettify(p))
  ).toEqual(["packages/util/__tests__/__fixtures__/a.txt"]);

  expect(
    (
      await findUp(["a.txt", "b.txt", "c.txt"], {
        cwd: fixtures,
        multipleAtLevel: true,
      })
    ).map(p => prettify(p))
  ).toEqual([
    "packages/util/__tests__/__fixtures__/a.txt",
    "packages/util/__tests__/__fixtures__/b.txt",
  ]);

  expect(
    (
      await findUp(["inner-a.txt", "a.txt", "b.txt", "c.txt"], {
        cwd: resolve(fixtures, "folder"),
        stopAt: fixtures,
        multipleAtLevel: true,
        multipleUp: true,
      })
    ).map(p => prettify(p))
  ).toEqual([
    "packages/util/__tests__/__fixtures__/folder/inner-a.txt",
    "packages/util/__tests__/__fixtures__/a.txt",
    "packages/util/__tests__/__fixtures__/b.txt",
  ]);
});
