import pathname from "../src";
import assert from "./_assert";

it( "relative", () => {

  [
    [ "/quasejs/test/aaa", "/quasejs/js/bbb", "../../js/bbb" ],
    [ "/quasejs/test", "/quasejs/test/aaa", "aaa" ],
    [ "/var/lib", "/var", ".." ],
    [ "/var/lib", "/bin", "../../bin" ],
    [ "/var/lib", "/var/lib", "." ],
    [ "/var/lib", "/var/apache", "../apache" ],
    [ "/var/", "/var/lib", "lib" ],
    [ "/", "/var/lib", "var/lib" ],
    [ "/foo/test", "/foo/test/bar/package.json", "bar/package.json" ],
    [ "/foo/test", "/foo/test/bar/package.json", "bar/package.json" ],
    [ "/Users/a/web/b/test/mails", "/Users/a/web/b", "../.." ]
  ].forEach( t => {

    assert.strictEqual( pathname.relative( t[ 0 ], t[ 1 ] ), t[ 2 ], "relative" );
    assert.strictEqual( pathname.relative( t[ 0 ], t[ 1 ].replace( /\//g, "\\" ) ), t[ 2 ], "relative with \\" );
    assert.strictEqual( pathname.resolve( t[ 0 ], t[ 2 ] ), t[ 1 ], "resolve" );

  } );

  assert.strictEqual( pathname.relative( "", "" ), "." );
  assert.strictEqual( pathname.relative( ".", "." ), "." );

} );
