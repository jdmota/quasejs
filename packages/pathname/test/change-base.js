import pathname from "../src";
import assert from "../../assert";

it( "change base", () => {

  [
    [ "/quasejs/test", "/quasejs/js", "/quasejs/test/aaa", "/quasejs/js/aaa" ],
    [ "/quasejs/test/", "/quasejs/js/", "/quasejs/test/aaa", "/quasejs/js/aaa" ],
    [ "/var/lib", "/", "/var/lib/bbb", "/bbb" ],
    [ "var/lib", "/", "var/lib/bbb", "/bbb" ],
    [ "var/lib", "", "var/lib/bbb", "bbb" ],
    [ "", "", "", "." ],
    [ ".", ".", ".", "." ],
  ].forEach( t => {

    assert.strictEqual( pathname.resolve( t[ 1 ], pathname.relative( t[ 0 ], t[ 2 ] ) ), t[ 3 ] );
    assert.strictEqual( pathname.changeBase( t[ 0 ], t[ 1 ], t[ 2 ] ), t[ 3 ] );
    assert.strictEqual( pathname.changeBase( t[ 0 ], t[ 1 ], t[ 2 ].replace( /\//g, "\\" ) ), t[ 3 ] );

  } );

} );
