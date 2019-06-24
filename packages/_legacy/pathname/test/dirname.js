import pathname from "../src";
import assert from "./_assert";

it( "dirname", () => {

  [
    [ "/a/b/", "/a" ],
    [ "/a/b", "/a" ],
    [ "/a", "/" ],
    [ "/a///b///", "/a" ],
    [ "///a/b", "/a" ],
    [ "/a//", "/" ],
    [ "/a/b/c", "/a/b" ],
    [ "/a/b/c/", "/a/b" ],
    [ "", "." ],
    [ "/", "/" ],
    [ "////", "/" ],
    [ "foo", "." ]
  ].forEach( t => {
    assert.strictEqual( pathname.dirname( t[ 0 ] ), t[ 1 ] );
    assert.strictEqual( pathname.dirname( t[ 0 ].replace( /\//g, "\\" ) ), t[ 1 ] );
  } );

  assert.throws( pathname.dirname.bind( null, null ), TypeError );
  assert.throws( pathname.dirname.bind( null, true ), TypeError );
  assert.throws( pathname.dirname.bind( null, 1 ), TypeError );
  assert.throws( pathname.dirname.bind( null ), TypeError );
  assert.throws( pathname.dirname.bind( null, {} ), TypeError );

} );
