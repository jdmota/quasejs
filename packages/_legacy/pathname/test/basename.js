import pathname from "../src";
import assert from "./_assert";

it( "basename", () => {

  [
    [ "abc/test-path.js", "test-path.js" ],
    [ "abc///test-path.js", "test-path.js" ],
    [ "", "" ],
    [ "/dir/basename.ext", "basename.ext" ],
    [ "/basename.ext", "basename.ext" ],
    [ "basename.ext", "basename.ext" ],
    [ "basename.ext/", "basename.ext" ],
    [ "basename.ext//", "basename.ext" ],
    [ "abc//basename.ext//", "basename.ext" ],
    [ "foo", "foo" ]
  ].forEach( t => {
    assert.strictEqual( pathname.basename( t[ 0 ] ), t[ 1 ] );
    assert.strictEqual( pathname.basename( t[ 0 ].replace( /\//g, "\\" ) ), t[ 1 ] );
  } );

  assert.strictEqual( pathname.basename( "abc/test-path.js", ".js" ), "test-path" );
  assert.strictEqual( pathname.basename( "abc///test-path.js", ".js" ), "test-path" );
  assert.strictEqual( pathname.basename( "abc\\test-path.js", ".js" ), "test-path" );
  assert.strictEqual( pathname.basename( "abc\\\\test-path.js", ".js" ), "test-path" );

  assert.throws( pathname.basename.bind( null, null ), TypeError );
  assert.throws( pathname.basename.bind( null, true ), TypeError );
  assert.throws( pathname.basename.bind( null, 1 ), TypeError );
  assert.throws( pathname.basename.bind( null ), TypeError );
  assert.throws( pathname.basename.bind( null, {} ), TypeError );

} );
