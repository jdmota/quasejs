import pathname from "../src";
import assert from "../../assert";

it( "extname", () => {

  [
    [ "abc/test-path.js", ".js" ],
    [ "abc/test-path.", "." ],
    [ "abc/test-path", "" ],
    [ "abc///test-path.js", ".js" ],
    [ "abc//test-path.", "." ],
    [ "abc////test-path", "" ],
    [ ".", "" ],
    [ "./", "" ],
    [ "./.", "" ],
    [ "././", "" ],
    [ "/", "" ],
    [ "", "" ],
    [ "......", "." ],
    [ "......ext", ".ext" ],
    [ "abc/......", "." ],
    [ "abc/......ext", ".ext" ],
    [ ".index", "" ],
    [ "abc/.index", "" ],
    [ "......//", "." ],
    [ "......ext//", ".ext" ],
    [ "abc/......//", "." ],
    [ "abc/......ext//", ".ext" ],
    [ ".index//", "" ],
    [ "abc/.index//", "" ],
    [ "foo", "" ]
  ].forEach( t => {
    assert.strictEqual( pathname.extname( t[ 0 ] ), t[ 1 ] );
    assert.strictEqual( pathname.extname( t[ 0 ].replace( /\//g, "\\" ) ), t[ 1 ] );
  } );

  assert.throws( pathname.extname.bind( null, null ), TypeError );
  assert.throws( pathname.extname.bind( null, true ), TypeError );
  assert.throws( pathname.extname.bind( null, 1 ), TypeError );
  assert.throws( pathname.extname.bind( null ), TypeError );
  assert.throws( pathname.extname.bind( null, {} ), TypeError );

} );
