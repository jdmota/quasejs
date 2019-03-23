const pnp = require( "../.pnp.js" );
pnp.setup();
const fs = require( "fs-extra" );
const path = require( "path" );

/* eslint-disable no-console */

const PNP = path.resolve( __dirname, "../.pnp.js" ).replace( /\\/g, "/" );
const ESLINT_PATH = path.resolve( __dirname, "node_modules", "eslint" );
const ESLINT_LIB = path.resolve( __dirname, "node_modules", "eslint", "lib" );
const PNP_RELATIVE = path.relative( ESLINT_LIB, PNP ).replace( /\\/g, "/" );

const api = `
const pnp = require( "${PNP_RELATIVE}" );
pnp.setupCompatibilityLayer();
pnp.setup();

module.exports = require( "eslint" );
`;

const pkg = `{
  "name": "eslint",
  "main": "./lib/api.js"
}`;

fs.outputFileSync( `${ESLINT_PATH}/lib/api.js`, api );
fs.outputFileSync( `${ESLINT_PATH}/package.json`, pkg );

console.log( "Done" );
