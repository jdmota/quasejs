import turbocolor from "turbocolor";

const fakeAnsiStyles: { [key: string]: { open: string; close: string } } = {};
for (const key in turbocolor.Styles) {
  fakeAnsiStyles[key] = {
    open: "",
    close: "",
  };
}

function createTheme(
  withColor: boolean,
  ansi: { [key: string]: { open: string; close: string } }
) {
  const prev = turbocolor.enabled;
  turbocolor.enabled = withColor;

  const theme = {
    boolean: ansi.yellow,
    circular: turbocolor.gray("[Circular]"),
    date: {
      invalid: turbocolor.red("invalid"),
      value: ansi.blue,
    },
    diffGutters: {
      actual: turbocolor.red("+") + " ",
      expected: turbocolor.green("-") + " ",
      padding: "  ",
    },
    error: {
      ctor: { open: ansi.gray.open + "(", close: ")" + ansi.gray.close },
      name: ansi.magenta,
    },
    function: {
      name: ansi.blue,
      stringTag: ansi.magenta,
    },
    global: ansi.magenta,
    item: { after: turbocolor.gray(",") },
    list: {
      openBracket: turbocolor.gray("["),
      closeBracket: turbocolor.gray("]"),
    },
    mapEntry: { after: turbocolor.gray(",") },
    maxDepth: turbocolor.gray("…"),
    null: ansi.yellow,
    number: ansi.yellow,
    object: {
      openBracket: turbocolor.gray("{"),
      closeBracket: turbocolor.gray("}"),
      ctor: ansi.magenta,
      stringTag: { open: ansi.magenta.open + "@", close: ansi.magenta.close },
      secondaryStringTag: {
        open: ansi.gray.open + "@",
        close: ansi.gray.close,
      },
    },
    property: {
      after: turbocolor.gray(","),
      keyBracket: { open: turbocolor.gray("["), close: turbocolor.gray("]") },
      valueFallback: turbocolor.gray("…"),
    },
    regexp: {
      source: { open: ansi.blue.open + "/", close: "/" + ansi.blue.close },
      flags: ansi.yellow,
    },
    stats: { separator: turbocolor.gray("---") },
    string: {
      open: ansi.blue.open,
      close: ansi.blue.close,
      line: { open: turbocolor.blue("'"), close: turbocolor.blue("'") },
      multiline: { start: turbocolor.blue("`"), end: turbocolor.blue("`") },
      controlPicture: ansi.gray,
      diff: {
        insert: {
          open: ansi.bgGreen.open + ansi.black.open,
          close: ansi.black.close + ansi.bgGreen.close,
        },
        delete: {
          open: ansi.bgRed.open + ansi.black.open,
          close: ansi.black.close + ansi.bgRed.close,
        },
        equal: ansi.blue,
        insertLine: {
          open: ansi.green.open,
          close: ansi.green.close,
        },
        deleteLine: {
          open: ansi.red.open,
          close: ansi.red.close,
        },
      },
    },
    symbol: ansi.yellow,
    typedArray: {
      bytes: ansi.yellow,
    },
    undefined: ansi.yellow,
  };

  turbocolor.enabled = prev;
  return theme;
}

export const color = {
  maxDepth: 3,
  theme: createTheme(true, turbocolor.Styles),
};

export const plain = {
  maxDepth: 3,
  theme: createTheme(false, fakeAnsiStyles),
};
