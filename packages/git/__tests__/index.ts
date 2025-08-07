import { isAbsolute, relative } from "path";
import { getDotGitDir, gitLs, parseGitStatusShortFormat } from "../git";

it("getDotGitDir", async () => {
  const result = await getDotGitDir("");

  expect(result).not.toBeNull();
  expect(isAbsolute(result!)).toBe(true);
  expect(relative(process.cwd(), result!)).toBe(".git");
});

it("gitLs", async () => {
  const result = await gitLs("packages/git/__tests__");

  expect(result).toEqual(["packages/git/__tests__/index.ts"]);
});

it("parseGitStatusShortFormat", () => {
  expect(parseGitStatusShortFormat(" M package.json")).toEqual({
    origPath: null,
    path: "package.json",
    x: "",
    y: "M",
  });

  expect(parseGitStatusShortFormat("?? packages/git/__tests__/")).toEqual({
    origPath: null,
    path: "packages/git/__tests__/",
    x: "?",
    y: "?",
  });

  expect(parseGitStatusShortFormat(" M package.json -> abc.json")).toEqual({
    origPath: "package.json",
    path: "abc.json",
    x: "",
    y: "M",
  });
});
