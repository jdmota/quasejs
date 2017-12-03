const importFresh = require( "import-fresh" );
const CircularJSON = require( "circular-json" );

function stringify( arg ) {
  return CircularJSON.stringify( arg, ( _, value ) => {
    if ( value instanceof Error ) {
      const obj = {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
      for ( const key in value ) {
        obj[ key ] = value[ key ];
      }
      return obj;
    }
    return value;
  } );
}

function send( eventType, arg ) {
  process.send( {
    type: "quase-unit-emit",
    eventType,
    arg: stringify( arg )
  } );
}

const onMessage = ( type, cli, files ) => {
  const { flags, config, configLocation } = cli;
  let options;

  if ( !configLocation || configLocation === "pkg" ) {
    options = Object.assign( {}, config, flags );
  } else {
    options = Object.assign( {}, require( configLocation ), flags );
  }

  global.quaseUnit = { options };

  const runner = importFresh( "./index.js" ).runner;

  [ "runStart", "testStart", "testEnd", "suiteStart", "suiteEnd", "runEnd", "otherError" ].forEach( eventType => {
    runner.on( eventType, arg => {
      send( eventType, arg );
    } );
  } );

  for ( const file of files ) {
    try {
      importFresh( file );
    } catch ( arg ) {
      send( "otherError", arg );
    }
  }

  process.on( "uncaughtException", arg => {
    send( "otherError", arg );
  } );

  runner.run();
};

process.on( "message", ( { type, cli, files } ) => {
  if ( type === "quase-unit-start" ) {
    try {
      onMessage( type, cli, files );
    } catch ( err ) {
      send( "otherError", err );
    }
  }
} );
