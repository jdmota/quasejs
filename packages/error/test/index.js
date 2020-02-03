import { beautify, getStack, locToString } from "../src";

const { SourceMapExtractor } = require("@quase/source-map");

const cwd = process.cwd();

function clean(string) {
  return string
    .split(cwd)
    .join("")
    .replace(/\\/g, "/")
    .split("\n")
    .filter(x => !/node_modules/.test(x))
    .join("\n");
}

function a(offset) {
  return b(offset);
}

function b(offset) {
  return c(offset);
}

function c(offset) {
  return clean(getStack(offset));
}

it("getStack", () => {
  expect(a()).toMatchSnapshot("undefined");
  expect(a(-1)).toMatchSnapshot("-1");
  expect(a(0)).toMatchSnapshot("0");
  expect(a(1)).toMatchSnapshot("1");
  expect(a(2)).toMatchSnapshot("2");
  expect(a(3)).toMatchSnapshot("3");
});

it("beautify", async () => {
  const stack = getStack();
  const extractor = new SourceMapExtractor();

  expect(
    (await beautify(stack, { extractor, ignore: /node_modules/ })).stack
  ).toMatchSnapshot();
});

it("beautify with title", async () => {
  const stack = new Error("title").stack;
  const extractor = new SourceMapExtractor();

  expect(
    (await beautify(stack, { extractor, ignore: /node_modules/ })).stack
  ).toMatchSnapshot();
});

it("handle multine error message correctly", async () => {
  const stack = new Error("multine\nerror\nmessage").stack;

  expect(
    (await beautify(stack, { ignore: /node_modules/ })).stack
  ).toMatchSnapshot();
});

it("handle just the title fine", async () => {
  const stack = "multine\nerror\nmessage";

  expect(
    (await beautify(stack, { ignore: /node_modules/ })).stack
  ).toMatchSnapshot();
});

it("keep at least one stack line", async () => {
  const stack = getStack(2);

  expect(
    (await beautify(stack, { ignore: /node_modules/ })).stack
  ).toMatchSnapshot();
});

it("locToString", () => {
  expect(locToString({})).toEqual("");
  expect(locToString({ line: 1 })).toEqual("1");
  expect(locToString({ column: 2 })).toEqual("");
  expect(locToString({ line: 1, column: 2 })).toEqual("1:2");
});
