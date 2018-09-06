import { getPlugins } from "../src";

it( "getPlugins", () => {

  expect( getPlugins(
    [
      [ "./packages/util/get-plugins/test/fixtures/export-default", { optKey: 10 } ],
      "./packages/util/get-plugins/test/fixtures/get-by-key[customKey]",
      "./packages/util/get-plugins/test/fixtures/module-exports",
      [ "map me", { optKey: 20 } ]
    ],
    n => ( n === "map me" ? "./packages/util/get-plugins/test/fixtures/module-exports" : n )
  ) ).toEqual( [
    { name: "./packages/util/get-plugins/test/fixtures/export-default", key: "default", plugin: { a: 10 }, options: { optKey: 10 } },
    { name: "./packages/util/get-plugins/test/fixtures/get-by-key", key: "customKey", plugin: { a: 10 }, options: {} },
    { name: "./packages/util/get-plugins/test/fixtures/module-exports", key: "default", plugin: { a: 10 }, options: {} },
    { name: "./packages/util/get-plugins/test/fixtures/module-exports", key: "default", plugin: { a: 10 }, options: { optKey: 20 } }
  ] );

} );
