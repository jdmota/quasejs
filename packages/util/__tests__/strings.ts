import { expect, it } from "@jest/globals";
import { countNewLineChars, findLoc } from "../strings";

it("countNewLineChars", () => {
  expect(countNewLineChars("")).toBe(0);
  expect(countNewLineChars("dada\n")).toBe(1);
  expect(countNewLineChars("dada\ndssdsd")).toBe(1);
  expect(countNewLineChars("dada\r\n")).toBe(1);
  expect(countNewLineChars("dada\r\ndssdsd")).toBe(1);
  expect(countNewLineChars("dada\r\n\n")).toBe(2);
  expect(countNewLineChars("dada\r\n\ndssdsd")).toBe(2);
});

it("findLoc", () => {
  expect(findLoc(0, `abc\nc`)).toEqual({
    line: 1,
    column: 0,
  });

  expect(findLoc(1, `abc\nc`)).toEqual({
    line: 1,
    column: 1,
  });

  expect(findLoc(4, `abc\nc`)).toEqual({
    line: 2,
    column: 0,
  });

  expect(findLoc(5, `abc\ncd`)).toEqual({
    line: 2,
    column: 1,
  });

  expect(findLoc(5, `abc\r\nc`)).toEqual({
    line: 2,
    column: 0,
  });

  expect(findLoc(6, `abc\r\ncd`)).toEqual({
    line: 2,
    column: 1,
  });
});
