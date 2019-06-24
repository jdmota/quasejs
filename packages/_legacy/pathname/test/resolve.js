import pathname from "../src";
import assert from "./_assert";

it( "resolve", () => {

  /* eslint no-multi-spaces: 0 */
  /* eslint comma-spacing: [0] */

  const base = "/a/b/c/d/e";

  [
    [ "../../../1"     , "/a/b/1" ],
    [ "../1"           , "/a/b/c/d/1" ],
    [ "./././1"        , "/a/b/c/d/e/1" ],
    [ "./1"            , "/a/b/c/d/e/1" ],
    [ "/../../../1"    , "/1" ],
    [ "/../1"          , "/1" ],
    [ "/./././1"       , "/1" ],
    [ "/./1"           , "/1" ],
    [ "../../../1/2/3" , "/a/b/1/2/3" ],
    [ "../1/2/3"       , "/a/b/c/d/1/2/3" ],
    [ "./././1/2/3"    , "/a/b/c/d/e/1/2/3" ],
    [ "./1/2/3"        , "/a/b/c/d/e/1/2/3" ],
    [ "./././1///2/3"  , "/a/b/c/d/e/1/2/3" ],
    [ "./1///2/3"      , "/a/b/c/d/e/1/2/3" ],
    [ "/../../../1/2/3", "/1/2/3" ],
    [ "/../1/2/3"      , "/1/2/3" ],
    [ "/./././1/2/3"   , "/1/2/3" ],
    [ "/./1/2/3"       , "/1/2/3" ],
    [ ".././.././1"    , "/a/b/c/1" ],
    [ ".././.././1/.." , "/a/b/c" ],
    [ ".././.././1/."  , "/a/b/c/1" ]
  ].forEach( t => {
    assert.strictEqual( pathname.resolve( base, t[ 0 ] ), t[ 1 ] );
    assert.strictEqual( pathname.resolve( base, t[ 0 ].replace( /\//g, "\\" ) ), t[ 1 ] );
  } );

  assert.strictEqual( pathname.resolve( "/", "/four" ), "/four" );
  assert.strictEqual( pathname.resolve( "/", "/four/abc" ), "/four/abc" );
  assert.strictEqual( pathname.resolve( "/", "four" ), "/four" );
  assert.strictEqual( pathname.resolve( "/", "four/abc" ), "/four/abc" );
  assert.strictEqual( pathname.resolve( "/", "page/dog" ), "/page/dog" );
  assert.strictEqual( pathname.resolve( "/", "/page/dog" ), "/page/dog" );
  assert.strictEqual( pathname.resolve( "/", "/" ), "/" );
  assert.strictEqual( pathname.resolve( "/", "" ), "/" );
  assert.strictEqual( pathname.resolve( "/", "/../../.." ), "/" );
  assert.strictEqual( pathname.resolve( "/", "/../../../a" ), "/a" );
  assert.strictEqual( pathname.resolve( "/", "../../.." ), "/" );
  assert.strictEqual( pathname.resolve( "/", "../../../a" ), "/a" );
  assert.strictEqual( pathname.resolve( "", "/../../.." ), "/" );
  assert.strictEqual( pathname.resolve( "", "/../../../a" ), "/a" );
  assert.strictEqual( pathname.resolve( "", "../../.." ), "../../.." );
  assert.strictEqual( pathname.resolve( "", "../../../a" ), "../../../a" );
  assert.strictEqual( pathname.resolve( "/one/two", "/" ), "/" );
  assert.strictEqual( pathname.resolve( "one/two", "/" ), "/" );
  assert.strictEqual( pathname.resolve( "one/two", "../" ), "one" );
  assert.strictEqual( pathname.resolve( "one/two", "../.." ), "." );
  assert.strictEqual( pathname.resolve( "one/two", "../../.." ), ".." );
  assert.strictEqual( pathname.resolve( "/one/two/three", "../four" ), "/one/two/four" );
  assert.strictEqual( pathname.resolve( "/one/two/three", "four" ), "/one/two/three/four" );
  assert.strictEqual( pathname.resolve( "abc", "/one", "./two", ".." ), "/one" );
  assert.strictEqual( pathname.resolve( "/", "", "/one" ), "/one" );
  assert.strictEqual( pathname.resolve( "", "", "" ), "." );
  assert.strictEqual( pathname.resolve( "" ), "." );

} );
