const req = require( "require-uncached" );

// TODO

process.on( "message", message => {
  switch ( message.type ) {
    case "require":
      req( message.arg );
      break;
    default:
  }
} );
