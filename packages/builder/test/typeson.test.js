import typeson from "../dist/workers/typeson";

it( "typeson", () => {

  const obj = {
    plugins: [
      [ "abc", { opt: 10 } ]
    ]
  };

  expect( typeson.revive( typeson.encapsulate( obj ) ) ).toEqual( obj );

} );
