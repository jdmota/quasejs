import pathname from "../src";
import assert from "../../assert";

it( "isAbsolute", () => {

  assert.strictEqual( pathname.isAbsolute( "/" ), true );
  assert.strictEqual( pathname.isAbsolute( "///abc/" ), true );
  assert.strictEqual( pathname.isAbsolute( "\\" ), true );
  assert.strictEqual( pathname.isAbsolute( "\\abc/" ), true );

  assert.strictEqual( pathname.isAbsolute( "./" ), false );
  assert.strictEqual( pathname.isAbsolute( "../" ), false );
  assert.strictEqual( pathname.isAbsolute( "../aaa" ), false );
  assert.strictEqual( pathname.isAbsolute( "" ), false );
  assert.strictEqual( pathname.isAbsolute( "." ), false );
  assert.strictEqual( pathname.isAbsolute( ".." ), false );

  assert.strictEqual( pathname.isAbsolute( "..\\aaa" ), false );

  assert.throws( pathname.isAbsolute.bind( null, {} ), TypeError );

} );
