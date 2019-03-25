#!/usr/bin/env node

const ban = require( ".." );

ban.bin( {
  all: !process.argv.includes( "--no-all" ) && !process.argv.includes( "--all=false" ),
  verbose: process.argv.includes( "--verbose" ) || process.argv.includes( "--verbose=true" )
} );
