import pathname from "../src";
import assert from "../../assert";

it( "pathToRegExp/match", () => {

  // [ Pattern, Path, Match result for end mode, Match result for not-end mode ]
  [
    [ "/**-a", "/b/c-a", {}, {} ],
    [ "////a+b////c/", "/a+b/c", {}, {} ],
    [ "////a+b////c/", "/a/c", null, null ],
    [ "/a+b", "/a+b", {}, {} ],
    [ "/a+b", "/abb", null, null ],
    [ "/a+(b)", "/abb", {}, {} ],
    [ "/a\\+(b)", "/a+b", {}, {} ],
    [ "/a\\+(b)", "/abb", null, null ],
    [ "/(a|b)", "/a", {}, {} ],
    [ "/(a|b)", "/c", null, null ],
    [ "/()", "/", {}, {} ],
    [ "/()", "/c", null, {} ],
    [ "/[ab]", "/a", {}, {} ],
    [ "/[ab]", "/c", null, null ],
    [ "/[!ab]", "/c", {}, {} ],
    [ "/[^ab]", "/c", {}, {} ],
    [ "/<foo**>-a", "/b-a", { foo: "b" }, { foo: "b" } ],
    [ "/**-a", "/.b-a", null, null ],
    [ "/", "/", {}, {} ],
    [ "/", "/abc", null, {} ],
    [ "/abc", "/", null, null ],
    [ "/abc", "/abc", {}, {} ],
    [ "/<foo**>", "/", { foo: undefined }, { foo: undefined } ],
    [ "/<foo?>", "/", { foo: undefined }, { foo: undefined } ],
    [ "/<foo*>", "/abc", { foo: "abc" }, { foo: "abc" } ],
    [ "/<foo*>", "/", { foo: undefined }, { foo: undefined } ],
    [ "/<foo*>", "/abc/cba", null, { foo: "abc" } ],
    [ "/<foo*>", "/abc.json", { foo: "abc.json" }, { foo: "abc.json" } ],
    [ "/<foo*>/abc", "/cba/abc", { foo: "cba" }, { foo: "cba" } ],
    [ "/", "/.json", null, {} ],
    [ "/<foo*>", "/.json", null, { foo: undefined } ],
    [ "/<foo>", "/.json", null, null ],
    [ "/<foo?>", "/.json", null, { foo: undefined } ],
    [ "/.json/abc", "/.json/abc", null, null ],
    [ "/*/abc", "/.json/abc", null, null ],
    [ "/:abc/foo", "/.json/foo", null, null ],
    [ "/:abc?/foo", "/.json/foo", null, null ],
    [ "/a/**/b", "a/.d/b", null, null ],
    [ "/a/**/b", "/a/.d/e/b", null, null ],
    [ "/a/**/b", "/a/e/.d/b", null, null ],
    [ "/abc/<foo*>", "/abc", { foo: undefined }, { foo: undefined } ],
    [ "/<foo**>/<bar>.js", "/abc.js", { foo: undefined, bar: "abc" }, { foo: undefined, bar: "abc" } ],
    [ "/<foo**>/<bar>.js", "/abc/foo.js", { foo: "abc", bar: "foo" }, { foo: "abc", bar: "foo" } ],
    [ "/<foo**>/<bar>.js", "/cba/abc/foo.js", { foo: "cba/abc", bar: "foo" }, { foo: "cba/abc", bar: "foo" } ],
    [ "/test", "/test/route", null, {} ],
    [ "/test", "/TEST", {}, {} ],
    [ "/<abc**>/<cba?>", "/", { abc: undefined, cba: undefined }, { abc: undefined, cba: undefined } ],
    [ "/<abc**>/<cba>", "/12", { abc: undefined, cba: "12" }, { abc: undefined, cba: "12" } ],
    [ "/<abc**>/<cba**>", "/12", { abc: "12", cba: undefined }, { abc: "12", cba: undefined } ],
    [ "/**", "/a/b/c", {}, {} ],
    [ "/<g**>", "/a/b/c", { g: "a/b/c" }, { g: "a/b/c" } ],
    [ "/<g>", "/a/b/c", null, { g: "a" } ],
    [ "/<g?>", "/a", { g: "a" }, { g: "a" } ],
    [ "/<g?>", "/", { g: undefined }, { g: undefined } ],
    [ "/<g**>", "/", { g: undefined }, { g: undefined } ],
    [ "/<g?>", "/a/b", null, { g: "a" } ],
    [ "/<g?>/b", "/b", { g: undefined }, { g: undefined } ],
    [ "/<g?>/b", "/a/b", { g: "a" }, { g: "a" } ],
    [ "/<abc>.<cba>", "/1.2", { abc: "1", cba: "2" }, { abc: "1", cba: "2" } ],
    [ "/<abc><cba>", "/1.2", { abc: "1", cba: ".2" }, { abc: "1", cba: ".2" } ],
    [ "/<test?>/bar", "/bar", { test: undefined }, { test: undefined } ],
    [ "/<test>/bar", "/bar/bar", { test: "bar" }, { test: "bar" } ],
    [ "/<test?>-bar", "/-bar", { test: undefined }, { test: undefined } ],
    [ "/<test?>-bar", "/abc-bar", { test: "abc" }, { test: "abc" } ],
    [ "/<test>.json", "/a.json", { test: "a" }, { test: "a" } ],
    [ "/<test>.json", "/a.json.json", { test: "a.json" }, { test: "a.json" } ],
    [ "/<test>.json", "/.json", null, null ],
    [ "/test.", "/test", null, null ],
    [ "/test.", "/test.", {}, {} ],
    [ "/<foo(a)>", "/a", { foo: "a" }, { foo: "a" } ],
    [ "/<foo(a)>", "/A", { foo: "A" }, { foo: "A" } ],
    [ "/abc/<foo>/cba", "/abc/12/cba", { foo: "12" }, { foo: "12" } ],
    [ "/abc/<foo?>/cba", "/abc/cba", { foo: undefined }, { foo: undefined } ],
    [ "/<foo**>baz", "/foo/bazbaz", { foo: "foo/baz" }, { foo: "foo/baz" } ],
    [ "/<foo**>baz", "/foo/baz", null, null ],
    [ "/<foo*>baz", "/baz", { foo: undefined }, { foo: undefined } ],
    [ "/<path**(abc|xyz)>", "/xyz/abc", { path: "xyz/abc" }, { path: "xyz/abc" } ],
    [ "/<path**(abc|xyz)>", "/abc/xyz", { path: "abc/xyz" }, { path: "abc/xyz" } ],
    [ "/<foo?(apple-)>icon-<res+([0-9])>.png", "/apple-icon-2.png", { foo: "apple-", res: "2" }, { foo: "apple-", res: "2" } ],
    [ "/<foo?(apple-)>icon-<res+([0-9])>.png", "/icon-2.png", { foo: undefined, res: "2" }, { foo: undefined, res: "2" } ],
    [ "/<foo?(apple-)>icon-<res+([0-9])>.png", "/apple-icon-23.png", { foo: "apple-", res: "23" }, { foo: "apple-", res: "23" } ],
    [ "/<foo?(apple-)>icon-<res+([0-9])>.png", "/icon-23.png", { foo: undefined, res: "23" }, { foo: undefined, res: "23" } ],
    [ "/<foo?(apple-)>icon-<res+([0-9])>.png", "/apple-icon-a.png", null, null ],
    [ "/<foo?(apple-)>icon-<res+([0-9])>.png", "/icon-a.png", null, null ],
    [ "/<foo>\\?", "/", null, null ],
    [ "/<foo>\\?", "/a", null, null ],
    [ "/<foo>\\?", "/a?", { foo: "a" }, { foo: "a" } ],
    [ "/abc/**foo", "/abc/foo", {}, {} ],
    [ "/abc/**foo", "/abc/bar/foo", null, null ],
    [ "/abc/<m**>foo", "/abc/barfoo", { m: "bar" }, { m: "bar" } ],
    [ "/abc/<m**>foo", "/abcfoo", null, null ],
    [ "/abc/<m**>", "/abc", { m: undefined }, { m: undefined } ],
    [ "/abc/<m*>foo", "/abc/foo", { m: undefined }, { m: undefined } ],
    [ "/abc/<m*>foo", "/abc/bar/foo", null, null ],
    [ "/abc/<m*>foo", "/abc/barfoo", { m: "bar" }, { m: "bar" } ],
    [ "/abc/<m*>foo", "/abcfoo", null, null ],
    [ "/abc/*", "/abc", {}, {} ]
  ].forEach( function( obj, i ) {

    const append = "\n'" + obj[ 0 ] + "' '" + obj[ 1 ] + "'";

    assert.deepEqual(
      pathname.match(
        obj[ 1 ],
        pathname.pathToRegExp( obj[ 0 ] )
      ),
      obj[ 2 ],
      i + " Case insensitive with end mode" + append
    );

    assert.deepEqual(
      pathname.match(
        obj[ 1 ],
        pathname.pathToRegExp( obj[ 0 ], { end: false } )
      ),
      obj[ 3 ],
      i + " Case insensitive params" + append
    );

    assert.deepEqual(
      pathname.match(
        obj[ 1 ] + "/",
        pathname.pathToRegExp( obj[ 0 ], { end: false } )
      ),
      obj[ 3 ],
      i + " Trailing slash should be optional" + append
    );

  } );

  [
    [ "/", "/", {}, {} ],
    [ "/abc", "/", null, null ],
    [ "/abc", "/abc", {}, {} ],
    [ "/*", "/abc", {}, {} ],
    [ "/*", "/", {}, {} ],
    [ "/*", "/abc/cba", null, {} ],
    [ "/abc/*", "/abc", {}, {} ],
    [ "/test", "/test/route", null, {} ],
    [ "/test", "/TEST", null, null ],
    [ "/(a)", "/a", {}, {} ],
    [ "/(a)", "/A", null, null ]
  ].forEach( function( obj, i ) {

    const append = "\n'" + obj[ 0 ] + "' '" + obj[ 1 ] + "'";

    assert.deepEqual(
      pathname.match(
        obj[ 1 ],
        pathname.pathToRegExp( obj[ 0 ], { caseSensitive: true } )
      ),
      obj[ 2 ],
      i + " Case sensitive with end mode" + append
    );

    assert.deepEqual(
      pathname.match(
        obj[ 1 ],
        pathname.pathToRegExp( obj[ 0 ], { caseSensitive: true, end: false } )
      ),
      obj[ 3 ],
      i + " Case sensitive" + append
    );

  } );

  assert.deepEqual(
    pathname.match(
      "/foo",
      pathname.pathToRegExp( "!/foo" )
    ),
    null,
    "Negation 1"
  );

  assert.deepEqual(
    pathname.match(
      "/bar",
      pathname.pathToRegExp( "!/foo" )
    ),
    {},
    "Negation 2"
  );

  [
    [ "/", "/.json", null ],
    [ "/<abc>", "/.json", { abc: ".json" } ],
    [ "/<abc>", "/.json", { abc: ".json" } ],
    [ "/<abc?>", "/.json", { abc: ".json" } ],
    [ "/.json/abc", "/.json/abc", {} ],
    [ "/<abc>/abc", "/.json/abc", { abc: ".json" } ],
    [ "/<abc>/foo", "/.json/foo", { abc: ".json" } ],
    [ "/<abc?>/foo", "/.json/foo", { abc: ".json" } ],
    [ "/<abc**>-a", "/.b-a", { abc: ".b" } ],
    [ "/a/<abc**>/b", "/a/.d/b", { abc: ".d" } ],
    [ "/a/<abc**>/b", "/a/.d/e/b", { abc: ".d/e" } ]
  ].forEach( function( obj, i ) {

    assert.deepEqual(
      pathname.match(
        obj[ 1 ],
        pathname.pathToRegExp( obj[ 0 ], { dot: true } )
      ),
      obj[ 2 ],
      i + " Dot mode"
    );

  } );

  assert.deepEqual(
    pathname.match(
      "/.json",
      pathname.pathToRegExp( "/.*", { dot: false } )
    ),
    null,
    "Dot mode is false"
  );

  assert.deepEqual(
    pathname.match(
      "/.json",
      pathname.pathToRegExp( "/.<foo>", { dot: true } )
    ),
    { foo: "json" },
    "Dot mode is true"
  );

} );

it( "pathToRegExp/match with negations", () => {

  let p = pathname.pathToRegExp( "/<foo!(a)>/*" );

  assert.deepEqual( pathname.match( "/.ab/c", p ), null );
  assert.deepEqual( pathname.match( "/a", p ), null );
  assert.deepEqual( pathname.match( "/b", p ), { foo: "b" } );
  assert.deepEqual( pathname.match( "/ab", p ), { foo: "ab" } );
  assert.deepEqual( pathname.match( "/ab/c", p ), { foo: "ab" } );

  p = pathname.pathToRegExp( "/<foo!(a)>/*", { dot: true } );

  assert.deepEqual( pathname.match( "/.ab/c", p ), { foo: ".ab" } );

  p = pathname.pathToRegExp( "/!(\\.a)", { dot: true } );

  assert.deepEqual( pathname.match( "/.a/c", p ), null );
  assert.deepEqual( pathname.match( "/.b/c", p ), null );

  p = pathname.pathToRegExp( "/!(\\.a)/*" );

  assert.deepEqual( pathname.match( "/.a/c", p ), null );
  assert.deepEqual( pathname.match( "/.ab/c", p ), null );

  p = pathname.pathToRegExp( "/!(abc)", { dot: true } );

  assert.deepEqual( pathname.match( "/abc", p ), null );
  assert.deepEqual( pathname.match( "/cba/d", p ), null );
  assert.deepEqual( pathname.match( "/cba", p ), {} );

  p = pathname.pathToRegExp( "/!(abc)/*", { dot: true } );

  assert.deepEqual( pathname.match( "/abc/c", p ), null );
  assert.deepEqual( pathname.match( "/cba/c", p ), {} );

  p = pathname.pathToRegExp( "/!(\\.a)/*", { dot: true } );

  assert.deepEqual( pathname.match( "/.a/c", p ), null );
  assert.deepEqual( pathname.match( "/.b/c", p ), {} );

  if ( true ) { // eslint-disable-line
    return; // FIXME
  }

  p = pathname.pathToRegExp( "/!(\\abc)-cba" );

  assert.deepEqual( pathname.match( "/abc-cba", p ), null );
  assert.deepEqual( pathname.match( "/a-cba", p ), {} );

  p = pathname.pathToRegExp( "/!(\\a)-cba" );

  assert.deepEqual( pathname.match( "/a-cba", p ), null );
  assert.deepEqual( pathname.match( "/abc-cba", p ), {} );

  p = pathname.pathToRegExp( "/!(\\a).cba" );

  assert.deepEqual( pathname.match( "/a.cba", p ), null );

  p = pathname.pathToRegExp( "/<foo!(+(a))>.cba" );

  assert.deepEqual( pathname.match( "/a.cba", p ), null );
  assert.deepEqual( pathname.match( "/aa.cba", p ), null );
  assert.deepEqual( pathname.match( "/ab.cba", p ), { foo: "ab" } );

  p = pathname.pathToRegExp( "/!(\\abc)!(\\cba)" );

  assert.deepEqual( pathname.match( "/foo", p ), {} );

} );
