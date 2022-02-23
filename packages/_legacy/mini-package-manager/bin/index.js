#!/usr/bin/env node

const command = process.argv[ 2 ];
const args = process.argv.slice( 3 );

require( "../src" ).default( command, args );
