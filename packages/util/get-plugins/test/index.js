import { getPlugins } from "../src";

it( "getPlugins", () => {

  expect( getPlugins(
    [
      [ "./export-default", { optKey: 10 } ],
      "./get-by-key[customKey]",
      "./module-exports",
      [ "./module-exports", { optKey: 20 } ]
    ],
    "./packages/util/get-plugins/test/fixtures"
  ) ).toEqual( [
    { name: "./export-default", key: "default", plugin: { a: 10 }, options: { optKey: 10 } },
    { name: "./get-by-key", key: "customKey", plugin: { a: 10 }, options: {} },
    { name: "./module-exports", key: "default", plugin: { a: 10 }, options: {} },
    { name: "./module-exports", key: "default", plugin: { a: 10 }, options: { optKey: 20 } }
  ] );

} );
