import { expect, it } from "@jest/globals";
import { resolve } from "node:path";
import { findUp, isFile, readFileString } from "../fs";

const fixtures = resolve(import.meta.dirname, "__fixtures__");

it("readFileString", async () => {
  await expect(readFileString(resolve(fixtures, "a.txt"))).resolves.toBe("a");
  await expect(readFileString(resolve(fixtures, "empty.txt"))).resolves.toBe(
    ""
  );
  await expect(readFileString(resolve(fixtures, "non-existant"))).resolves.toBe(
    ""
  );
});

it("isFile", async () => {
  await expect(isFile(import.meta.filename, true)).resolves.toBe(true);
  await expect(isFile(resolve(fixtures, "a.txt"), true)).resolves.toBe(true);
  await expect(isFile(resolve(fixtures, "non-existant"), true)).resolves.toBe(
    false
  );
});

it("findUp", async () => {
  await expect(
    findUp(["a.txt", "b.txt", "c.txt"], {
      cwd: fixtures,
    })
  ).resolves.toMatchSnapshot();

  await expect(
    findUp(["a.txt", "b.txt", "c.txt"], {
      cwd: fixtures,
      multipleAtLevel: true,
    })
  ).resolves.toMatchSnapshot();

  await expect(
    findUp(["inner-a.txt", "a.txt", "b.txt", "c.txt"], {
      cwd: resolve(fixtures, "folder"),
      stopAt: fixtures,
      multipleAtLevel: true,
      multipleUp: true,
    })
  ).resolves.toMatchSnapshot();
});
