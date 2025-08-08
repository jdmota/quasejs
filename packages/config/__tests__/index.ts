import { expect, it } from "@jest/globals";
import path from "path";
import { prettify } from "../../util/path-url";
import { getConfig } from "../index";

const fixturesFolder = path.resolve(import.meta.dirname, "__fixtures__");

it("get config non-multiple level", async () => {
  const results = await getConfig({
    sources: [
      {
        files: "quase-config",
        extensions: ["ts", "mts", "cts", "js", "mjs", "cjs", "json", ""],
      },
      {
        files: "package.json",
        extensions: [],
        rewrite({ config }) {
          return (config as any)["my-key"];
        },
      },
      {
        files: "non-existent-file",
      },
    ],
    findUpOpts: {
      cwd: fixturesFolder,
      stopAt: process.cwd(),
    },
  });

  expect(
    results.map(r => {
      return {
        ...r,
        filename: prettify(r.filename),
      };
    })
  ).toMatchSnapshot();
});

it("get config multiple level", async () => {
  const results = await getConfig({
    sources: [
      {
        files: "quase-config",
        extensions: ["ts", "mts", "cts", "js", "mjs", "cjs", "json", ""],
      },
      {
        files: "package.json",
        extensions: [],
        rewrite({ config }) {
          return (config as any)["my-key"];
        },
      },
      {
        files: "non-existent-file",
      },
    ],
    findUpOpts: {
      cwd: fixturesFolder,
      stopAt: process.cwd(),
      multipleAtLevel: true,
    },
  });

  expect(
    results.map(r => {
      return {
        ...r,
        filename: prettify(r.filename),
      };
    })
  ).toMatchSnapshot();
});
