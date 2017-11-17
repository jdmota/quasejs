const ansiStyles = require( "ansi-styles" );
const chalk = require( "chalk" );

const withColor = new chalk.constructor( { enabled: true } );
const noColor = new chalk.constructor( { enabled: false } );

const fakeAnsiStyles = {};
for ( const key in ansiStyles ) {
  fakeAnsiStyles[ key ] = {
    open: "",
    close: ""
  };
}

function createTheme( chalk, ansi ) {
  return {
    boolean: ansi.yellow,
    circular: chalk.grey( "[Circular]" ),
    date: {
      invalid: chalk.red( "invalid" ),
      value: ansi.blue
    },
    diffGutters: {
      actual: chalk.red( "-" ) + " ",
      expected: chalk.green( "+" ) + " ",
      padding: "  "
    },
    error: {
      ctor: { open: ansi.grey.open + "(", close: ")" + ansi.grey.close },
      name: ansi.magenta
    },
    function: {
      name: ansi.blue,
      stringTag: ansi.magenta
    },
    global: ansi.magenta,
    item: { after: chalk.grey( "," ) },
    list: { openBracket: chalk.grey( "[" ), closeBracket: chalk.grey( "]" ) },
    mapEntry: { after: chalk.grey( "," ) },
    maxDepth: chalk.grey( "…" ),
    null: ansi.yellow,
    number: ansi.yellow,
    object: {
      openBracket: chalk.grey( "{" ),
      closeBracket: chalk.grey( "}" ),
      ctor: ansi.magenta,
      stringTag: { open: ansi.magenta.open + "@", close: ansi.magenta.close },
      secondaryStringTag: { open: ansi.grey.open + "@", close: ansi.grey.close }
    },
    property: {
      after: chalk.grey( "," ),
      keyBracket: { open: chalk.grey( "[" ), close: chalk.grey( "]" ) },
      valueFallback: chalk.grey( "…" )
    },
    regexp: {
      source: { open: ansi.blue.open + "/", close: "/" + ansi.blue.close },
      flags: ansi.yellow
    },
    stats: { separator: chalk.grey( "---" ) },
    string: {
      open: ansi.blue.open,
      close: ansi.blue.close,
      line: { open: chalk.blue( "'" ), close: chalk.blue( "'" ) },
      multiline: { start: chalk.blue( "`" ), end: chalk.blue( "`" ) },
      controlPicture: ansi.grey,
      diff: {
        insert: {
          open: ansi.bgGreen.open + ansi.black.open,
          close: ansi.black.close + ansi.bgGreen.close
        },
        delete: {
          open: ansi.bgRed.open + ansi.black.open,
          close: ansi.black.close + ansi.bgRed.close
        },
        equal: ansi.blue,
        insertLine: {
          open: ansi.green.open,
          close: ansi.green.close
        },
        deleteLine: {
          open: ansi.red.open,
          close: ansi.red.close
        }
      }
    },
    symbol: ansi.yellow,
    typedArray: {
      bytes: ansi.yellow
    },
    undefined: ansi.yellow
  };
}

export default {
  maxDepth: 3,
  theme: createTheme( withColor, ansiStyles )
};

export const plain = {
  maxDepth: 3,
  theme: createTheme( noColor, fakeAnsiStyles )
};
