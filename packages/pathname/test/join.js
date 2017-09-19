import pathname from "../src";
import assert from "../../assert";

it( "join", () => {

  assert.strictEqual( pathname.join( "foo", "baz/asdf", "quux", ".." ), "foo/baz/asdf" );
  assert.strictEqual( pathname.join( "/foo", "baz/asdf", "quux", ".." ), "/foo/baz/asdf" );
  assert.strictEqual( pathname.join( "foo", "baz/asdf", "quux", ".." ), "foo/baz/asdf" );
  assert.strictEqual( pathname.join( "///foo", "baz///asdf", "quux", ".." ), "/foo/baz/asdf" );
  assert.strictEqual( pathname.join( "foo", "baz///asdf", "quux", ".." ), "foo/baz/asdf" );
  assert.strictEqual( pathname.join( "/foo", "baz/asdf", "///quux", ".." ), "/foo/baz/asdf" );
  assert.strictEqual( pathname.join( "", "" ), "." );
  assert.strictEqual( pathname.join( "", "/" ), "/" );
  assert.strictEqual( pathname.join( "a", "/" ), "a" );

  assert.strictEqual( pathname.join( "foo", "baz\\asdf", "quux", ".." ), "foo/baz/asdf" );
  assert.strictEqual( pathname.join( "\\foo", "baz\\asdf", "quux", ".." ), "/foo/baz/asdf" );
  assert.strictEqual( pathname.join( "foo", "baz\\asdf", "\\quux", ".." ), "foo/baz/asdf" );

  assert.throws( pathname.join.bind( null, "foo", "baz/asdf/", {}, ".." ), TypeError );

} );
