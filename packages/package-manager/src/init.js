// @flow

const { getOnePlugin } = require( "@quase/get-plugins" );
const fs = require( "fs-extra" );
const path = require( "path" );

export const defaultConfig = {
  ".npmignore": [
    "*.txt",
    "*.log",
    "__dev__",
    "test",
    "node_modules",
    "package-lock.json",
    "qpm-lockfile.json",
    "yarn.lock",
    ""
  ].join( "\n" ),

  ".eslintignore": [
    "__dev__",
    "coverage",
    "dist",
    "flow-typed",
    "node_modules",
    ""
  ].join( "\n" ),

  ".gitignore": [
    "*.txt",
    "*.log",
    ".nyc_output",
    "__dev__",
    "coverage",
    "dist",
    "node_modules",
    "DRAFT-CHANGELOG.md",
    ""
  ].join( "\n" ),

  ".gitattributes": [
    "* text=auto",
    "*.js eol=lf",
    "*.json eol=lf",
    "",
  ].join( "\n" ),

  ".editorconfig": [
    "# This file is for unifying the coding style for different editors and IDEs",
    "# editorconfig.org",
    "",
    "root = true",
    "",
    "[*]",
    "end_of_line = lf",
    "charset = utf-8",
    "trim_trailing_whitespace = true",
    "insert_final_newline = true",
    "indent_style = space",
    "indent_size = 2",
    "",
  ].join( "\n" ),

  ".eslintrc.json": JSON.stringify( {
    extends: "@quase/eslint-config-quase"
  }, null, 2 ) + "\n",

  "package.json": JSON.stringify( {
    private: true,
    name: "NAME",
    version: "0.1.0-0",
    description: "DESCRIPTION",
    homepage: "PAGE",
    author: "AUTHOR",
    license: "LICENSE",
    repository: {
      url: "https://github.com/USER/REPO",
      type: "git"
    },
    main: "dist/index.js",
    dependencies: {},
    devDependencies: {
      "@babel/cli": "7.0.0-beta.36",
      "@quase/eslint-config-quase": "^0.2.0",
      eslint: "^4.14.0"
    }
  }, null, 2 ) + "\n"
};

export default async function( folder: string, plugin: ?string ) {

  const config = plugin ? getOnePlugin( plugin ) : defaultConfig;
  const promises = [];

  for ( const key in config ) {
    promises.push( ( async() => {

      const fullPath = path.join( folder, key );

      if ( await fs.pathExists( fullPath ) ) {
        return `${key} already exists!`;
      }

      await fs.writeFile( fullPath, config[ key ] );
      return `${key} was created.`;
    } )() );
  }

  return Promise.all( promises ).then( infos => {
    if ( infos.length === 0 ) {
      return "Created 0 files.";
    }
    return infos.join( "\n" ) + "\n";
  } );
}
