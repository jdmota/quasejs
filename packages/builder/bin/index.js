#!/usr/bin/env node
/* eslint-disable no-shebang */

require( "@quase/cli" ).default( function( o ) {
  require( "../dist" ).default( o.flags );
} );
