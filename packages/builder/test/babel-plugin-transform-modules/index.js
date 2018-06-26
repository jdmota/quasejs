import plugin from "../../src/languages/babel-plugin-transform-modules";

describe( "babel transform modules", () => {

  const fs = require( "fs-extra" );
  const path = require( "path" );
  const babel = require( "@babel/core" );

  const FIXTURES = path.resolve( "packages/builder/test/babel-plugin-transform-modules/fixtures" );
  const folders = fs.readdirSync( FIXTURES );

  folders.forEach( folder => {

    if ( folder === "__dev__" || folder === "imports-babel-transform-runtime" ) { // TODO temp fix
      return;
    }

    it( `babel-plugin-transform-modules - Fixture: ${folder}`, async() => {

      const fixturePath = path.resolve( FIXTURES, folder );
      const file = path.resolve( fixturePath, "actual.js" );
      const configPath = path.resolve( fixturePath, "config.js" );

      let config;

      try {
        config = Object.assign( require( configPath ) );
      } catch ( e ) {
        config = {};
      }

      config.babelrc = false;
      config.configFile = false;
      config.filename = file;

      config.parserOpts = Object.assign( {
        sourceType: "module",
        allowImportExportEverywhere: true,
        plugins: [ "dynamicImport", "exportExtensions", "exportDefaultFrom", "exportNamespaceFrom", "jsx" ]
      }, config.parserOpts );

      config.plugins = ( config.plugins || [] ).concat( [ require( "@babel/plugin-external-helpers" ), plugin ] );
      config.sourceMaps = true;

      const code = await fs.readFile( file, "utf8" );

      const out = babel.transformSync( code, config );

      expect( out.code ).toMatchSnapshot();
      expect( out.map.mappings ).toBeTruthy();

    } );

  } );

} );
