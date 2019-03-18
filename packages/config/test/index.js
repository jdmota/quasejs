import { getConfig } from "../src";

it( "get config", async() => {

  let result = await getConfig( {
    cwd: __dirname,
    configFiles: "quase-config.js",
  } );

  expect( result.config.iAmTheConfigFile ).toBe( "yes" );
  expect( typeof result.location ).toBe( "string" );

  result = await getConfig( {
    cwd: __dirname,
    configFiles: "non-existent-file.js",
  } );

  expect( result.config ).toBe( undefined );
  expect( result.location ).toBe( undefined );

  result = await getConfig( {
    cwd: __dirname,
    configFiles: "non-existent-file.js",
    configKey: "my-key"
  } );

  expect( result.config.configFromPkg ).toBe( "yes" );
  expect( typeof result.location ).toBe( "string" );
  expect( result.location.endsWith( "package.json" ) ).toBe( true );

  result = await getConfig( {
    cwd: __dirname,
    configFiles: "quase-config-2.js",
    configKey: "my-key"
  } );

  expect( result.config.iAmTheConfigFile2 ).toBe( "yes" );
  expect( result.config.configFromPkg ).toBe( undefined );
  expect( result.location.endsWith( "quase-config-2.js" ) ).toBe( true );

  await expect(
    getConfig( {
      cwd: __dirname,
      configFiles: "non-existante-file.js",
      failIfNotFound: true
    } )
  ).rejects.toThrow( /^Config file was not found/ );

  result = await getConfig( {
    cwd: __dirname,
    configFiles: [],
    configKey: ""
  } );

  expect( result.config ).toBe( undefined );
  expect( result.location ).toBe( undefined );

  result = await getConfig( {
    cwd: __dirname,
    arg: 10,
    configFiles: "quase-config-3.js"
  } );

  expect( result.config.fromFunction ).toBe( "yes" );
  expect( result.config.arg ).toBe( 10 );
  expect( result.location.endsWith( "quase-config-3.js" ) ).toBe( true );

} );
