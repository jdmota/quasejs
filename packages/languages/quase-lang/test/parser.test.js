// @flow
import { Parser } from "../src/frontend/parser";

declare function test(a: any, b: any): void;
declare function expect(a: any): any;

function serializeAst(ast: any, indent: string = ""): string {
  const { start, end } = ast.loc || { start: {}, end: {} };
  const header = ast.type
    ? `${ast.type} (${start.line}:${start.column}-${end.line}:${end.column})\n`
    : "Object\n";
  let str = header;

  for (const key of Object.keys(ast).sort()) {
    const node = ast[key];
    if (key === "type" || key === "loc") {
      continue;
    }
    if (Array.isArray(node)) {
      str += `${indent}  ${key}\n`;
      for (const subNode of node) {
        str += `${indent}    ${serializeAst(subNode, indent + "    ")}\n`;
      }
    } else if (node != null && typeof node === "object") {
      str += `${indent}  ${key}: ${serializeAst(node, indent + "  ")}\n`;
    } else if (typeof node === "number") {
      str += `${indent}  ${key}: N(${node})\n`;
    } else if (typeof node === "string") {
      str += `${indent}  ${key}: S(${node})\n`;
    } else if (node !== undefined) {
      str += `${indent}  ${key}: ${node}\n`;
    }
  }

  return str.replace(/\n$/, "");
}

const tests = {
  basic: "val a = 10; // abc",
  // Additive
  exp1: "x + y;",
  exp2: "x - y;",
  exp3: '"a" + 42;',
  // Assigment
  exp4: "x = 40;",
  exp5: "x *= 30;",
  exp6: "x /= 15;",
  exp7: "x %= 15;",
  exp8: "x += 40;",
  exp9: "x -= 40;",
  exp10: "x <<= 2;",
  exp11: "x >>= 4;",
  exp12: "x >>>= 8;",
  exp13: "x &= 2;",
  exp14: "x ^= 4;",
  exp15: "x |= 8;",
  // Binary bitwise
  exp16: "x & y;",
  exp17: "x ^ y;",
  exp18: "x | y;",
  // Binary logical
  exp19: "x || y;",
  exp20: "x && y;",
  exp21: "x || y || z;",
  exp22: "x && y && z;",
  exp23: "x || y && z;",
  exp24: "x || y ^ z;",
  // Binary
  exp25: "x + y + z;",
  exp26: "x - y + z;",
  exp27: "x + y - z;",
  exp28: "x - y - z;",
  exp29: "x + y * z;",
  exp30: "x + y / z;",
  exp31: "x - y % z;",
  exp32: "x * y * z;",
  exp33: "x * y / z;",
  exp34: "x * y % z;",
  exp35: "x % y * z;",
  exp36: "x << y << z;",
  exp37: "x | y | z;",
  exp38: "x & y & z;",
  exp39: "x ^ y ^ z;",
  exp40: "x & y | z;",
  exp41: "x | y ^ z;",
  exp42: "x | y & z;",
  // Bitwise shift
  exp43: "x << y;",
  exp44: "x >> y;",
  exp45: "x >>> y;",
  // Complex
  exp46: "a || b && c | d ^ e & f == g < h >>> i + j * k;",
  // Conditional
  exp47: "y ? 1 : 2;",
  exp48: "x && y ? 1 : 2;",
  exp49: "x = (0) ? 1 : 2;",
  // Equality
  exp50: "x == y;",
  exp51: "x != y;",
  exp52: "x === y;",
  exp53: "x != y;",
  // Grouping
  exp54: "(1) + (2  ) + 3;",
  exp55: "4 + 5 << (6);",
  // Subscripts
  exp56: "foo();",
  exp57: "foo().bar();",
  exp58: "foo()[bar];",
  exp59: "foo.bar();",
  exp60: "(foo()).bar();",
  exp61: "foo( bar, baz );",
  exp62: "( foo   )();",
  exp63: "abc.cba;",
  exp64: "foo.bar.baz;",
  exp65: "x.y.z.w;",
  exp66: "foo[bar];",
  exp67: "foo[42].bar;",
  exp68: "universe(42).galaxies;",
  exp69: "universe(42).galaxies(14, 3, 77).milkyway;",
  exp70: "earth.asia.Indonesia.prepareForElection(2014);",
  exp71: "universe.if;",
  exp72: "universe.true;",
  exp73: "universe.false;",
  exp74: "universe.null;",
  // Multiplicative
  exp75: "x * y;",
  exp76: "x / y;",
  exp77: "x % y;",
  // Postfix
  exp78: "x++;",
  exp79: "x--;",
  // Relational
  exp80: "x < y;",
  exp81: "x > y;",
  exp82: "x <= y;",
  exp83: "x >= y;",
  exp84: "x in y;",
  exp85: "x is y;",
  exp86: "x !in y;",
  exp87: "x !is y;",
  exp88: "x < y < z;",
  // Unary
  exp89: "++x;",
  exp90: "--x;",
  exp91: "+x;",
  exp92: "-x;",
  exp93: "~x;",
  exp94: "!x;",
  exp95: "typeof x;",
  // Exponential
  exp96: "x ** y;",
  exp97: "-(5 ** 6);",
  exp98: "2 ** (3 ** 2);",
  exp99: "2 ** 3 ** 2;",
  exp100: "(2 ** -1) * 2;",
  exp101: "2 ** -1 * 2;",
  exp102: "(-5) ** 6;",
  // Member expressions, bind expressions, null propagation, non-null expression
  exp103: "a?.b.c;",
  exp104: "a.b?.c;",
  exp105: "a?.b.c.d.e?.f;",
  exp106: "a.b.c?.d.e.f;",
  exp107: "a.b?(c);",
  exp108: "a.b?[c];",
  exp109: "a.b?(c)?.d;",
  exp110: "a.b?[c]?.d;",
  exp111: "a!;",
  exp112: "a!.b.c.d.e!.f;",
  exp113: "a.b.c!.d.e.f;",
  exp114: "a::b;",
  exp115: "a::b::c;",
  exp116: "a::b();",
  exp117: "a::b::c();",
  exp118: "a!::b();",
  exp119: "a!::b::c();",
  exp120: "a?.b::c();",
  exp121: "a.0.1;",
  exp122: "a.0?.1;",
  exp123: "a.0!.1;",
  exp124: "a.0.0.0.0.0;",
  exp125: "a.0.0.0.0.0().0;",
  exp126: "1 - 2;",
  exp127: "1 - -2;",
  exp128: "1 - +2;",
  exp129: "1 + -2;",
  exp130: "1 + +2;",
  // Declarations
  decl1: "val a = 10;",
  decl2: "val [ a, b ] = new [ 0, 1 ];",
  decl3: "val { x, ...y } = new { a: 10, ...b };",
  decl4: "val [ a, ...b ] = new [ 0, 1 ];",
  decl5: "val { a, b: [ b, c ] } = o;",
  decl6: "val { a, b: [ b, c = 0 ] } = o;",
  decl7: "val { a = 0, b: [ b, c ] } = o;",
  decl8: "val { a: x, b: [ b, c ] } = o;",
  decl9: "fun a() {};",
  decl10: "fun a( a, { b }, [ c ], d = 0, ...e ) {};",
  decl11: "async fun a() { val a = 0; };",
  decl12: "rec fun a() { a(); };",
  decl13: "val { a } = (fun() = new {a:10})();",
  decl14: "val { a } = (async fun() = new {a:10})();",
  decl15: `class A {
    val x = 0, y = 1;
    var z;
    fun init() {
      this.x = 1;
      y++;
    }
    a() {}
    async b() {}
    abstract open c() {}
    override d() {}
  };`,
  decl16: `@classDecorator open class A : B, C {
    @decrepted
    override d() {}
  };`,
  decl17: `abstract class A extends B, C {
    final override async rec d() {}
  };`,
  decl18: `abstract class A( T, E ) extends B, C {
    method( x: T, y: E ) {}
  };`,
  decl19: `class A {
    method() {}
    @classDecorator open class A : B, C {
      @decrepted
      override d() {}
    }
  };`,
  decl20: "fun a( a: A, { b }: B, [ c ]: C, d: D = 0, ...e: E ) {};",
  decl21:
    "fun a( var a: A, val { b }: B, var [ c ]: C, val d: D = 0, var ...e: E ) {};",
  decl22: `class A extends B {
    init() = super();
    override a() {
      super.a();
    }
  };`,
  decl23: `async gen fun a() {
    yield 1 + 2;
    await 1 + 2;
    yield* 1 + 2;
    await* 1 + 2;
    throw 1 + 2;
    return 1 + 2;
  };`,
  decl24: "fun a(): T = {};",
  decl25: "fun a(): T {};",
  // Assignments
  assig1: "a = 10;",
  assig2: "a += 10;",
  assig3: "a -= 10;",
  assig4: "a >>>= 10;",
  assig5: "a >>= 10;",
  assig6: "a <<= 10;",
  assig7: "a *= 10;",
  assig8: "a /= 10;",
  assig9: "a %= 10;",
  assig10: "a **= 10;",
  assig11: "a &= 1;",
  assig12: "a |= 1;",
  assig13: "a ^= 1;",
  // If, etc...
  flow1: "if ( true ) {};",
  flow2: "if true {};",
  flow3: "if true: console.log();",
  flow4: "if ( true ) console.log();",
  flow5: "if ( true ): console.log();",
  flow6: "if true {} else {};",
  flow7: "if true {} else if true {};",
  flow8: "if true {} else if true {} else {};",
  flow9: "if true: log() else if true: log() else log();",
  flow10: "if true: log() else if true: log() else: log();",
  flow11: "if true: {} else if true: {} else: {};",
  flow12: "while true {};",
  flow13: "while ( true ) {};",
  flow14: "while true: log();",
  flow15: "while true: { log(); };",
  flow16: "do {} while true;",
  flow17: "do {} while ( true );",
  flow18: "do log() while true;",
  flow19: "do: log() while true;",
  flow20: "do { log(); } while true;",
  flow21: "try {};",
  flow22: "try: log();",
  flow23: "try log();",
  flow24: "try {} catch {};",
  flow25: "try {} catch: log();",
  flow26: "try {} catch log();",
  flow27: "try {} catch {} finally {};",
  flow28: "try {} catch {} finally: log();",
  flow29: "try {} catch {} finally log();",
  flow30: "try {} finally {};",
  flow31: "try {} finally: log();",
  flow32: "try {} finally log();",
  flow33: "try {} catch ( e ) {};",
  flow34: "try {} catch ( e ): log();",
  flow35: "try {} catch ( e ) log();",
  flow36: "try {} catch ( { stack } ) {};",
  flow37: "try {} catch ( { stack } ): log();",
  flow38: "try {} catch ( { stack } ) log();",
  flow39: "for ;; {};",
  flow40: "for ;; : log();",
  flow41: "for (;;) log();",
  flow42: "for val { a } in o {};",
  flow43: "for val { a } in o : log();",
  flow44: "for ( val { a } in o ) log();",
  flow45: "for var a = 0; true; a++ {};",
  flow46: "for var a = 0; true; a++ : log();",
  flow47: "for var a = 0;; : log();",
  flow48: "for var a = 0;; a++ : log();",
  flow49: "for ( var a = 0;; ) log();",
  flow50: "for ( var a = 0;; a++ ) log();",
  flow51: "for await val { a } in o {};",
  flow52: "for await ( val { a } in o ) log();",
  flow53: "for await var a = 0;; {};",
  flow54: "for await ( var a = 0;; ) log();",
  flow55: "while ( true ) break;",
  flow56: "while ( true ) continue;",
  flow57: "foo@while ( true ) break@foo;",
  flow58: "foo@while ( true ) continue@foo;",
  flow59: "foo@for ( ;true; ) break@foo;",
  flow60: "foo@for ( ;true; ) continue@foo;",
  flow61: "foo@do break@foo while true;",
  flow62: "foo@do continue@foo while true;",
  // imports/exports
  import1: "import( `abc.js` );",
  import2: "import {} from `abc.js`;",
  import3: "import { a, b: [ c ], d: { e: f }, ...i } from `abc.js`;",
  import4: "export { a: 0 };",
  import5: "export val a = 10;",
  import6: "export fun a() {}",
  import7: "export class a {}",
  import8: "export async fun a() {}",
  import9: "export sealed class a {}",
  // Meta properties
  meta1: "import.currentScript;",
  meta2: "fun.sent;",
  // Literals
  literal1: "#/a[a]/;",
  literal2: "10;",
  literal3: "10n;",
  literal4: "'a';",
  literal5: "null;",
  literal6: "true;",
  literal7: "false;",
  literal8: '"${a()}";', // eslint-disable-line no-template-curly-in-string
  literal9: '"foo${a()}";', // eslint-disable-line no-template-curly-in-string
  literal10: '"foo${a()}bar";', // eslint-disable-line no-template-curly-in-string
  literal11: "10_0_0;",
  literal12: "0b11;",
  literal13: "0o11;",
  literal14: "0x11;",
  literal15: "`abc.js`;",
  // Debugger
  debugger1: "debugger;",
  debugger2: "( debugger, 10 );",
};

const errors = {
  expon1: "-5 ** 6;",
  expon2: "(-5 ** 6);",
  exported1: "export fun() {}",
  exported2: "export class() {}",
};

for (const key in tests) {
  test(`parser: ${key}`, () => {
    const input = tests[key];
    const parser = new Parser({ input });

    try {
      expect(serializeAst(parser.parse())).toMatchSnapshot(key);
    } catch (e) {
      expect(e.stack).toBe(key);
    }
  });
}

for (const key in errors) {
  const snapKey = "error " + key;
  test(`parser: ${snapKey}`, () => {
    const input = errors[key];
    const parser = new Parser({ input });

    try {
      parser.parse();
    } catch (e) {
      expect(e).toMatchSnapshot(snapKey);
      return;
    }

    expect(false).toBe(key);
  });
}

/* TODO test( "skip hashbang", () => {

  const input = "#! abc\nval a = 10; // abc";
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

test( "regexp", () => {

  const input = "val a = #/[/]/g;";
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

test( "char constant", () => {

  const input = "val a = 'a';";
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

test( "char constant empty", () => {

  const input = "val a = '';";
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

test( "char constant with escape", () => {

  const input = "val a = '\\n';";
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

test( "string constant", () => {

  const input = 'val a = "aaaa";';
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

test( "string constant with escape", () => {

  const input = 'val a = "a\\"aa";';
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );


test( "string constant with new line", () => {

  const input = 'val a = "a\naa"';
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

test( "string template", () => {

  const input = 'val a = "${a}"'; // eslint-disable-line
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

test( "string template with string inside", () => {

  const input = 'val a = "${"a"}"'; // eslint-disable-line
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

test( "string template back quote", () => {

  const input = 'val a = `"`';
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

test( "string template with spaces", () => {

  const input = 'val a = ` " `';
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

test( "babel/babylon/issues/622", () => {

  const input = "a <!-- b"; // a < !(--b)
  const parser = new Parser( { input } );

  expect( parser.parse() ).toMatchSnapshot();

} );

*/
