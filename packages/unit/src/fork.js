const importFresh = require( "import-fresh" );
const CircularJSON = require( "circular-json" );
const concordance = require( "concordance" );

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
    if ( value instanceof Buffer ) {
      return Array.from( Buffer );
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

function start( cli, files ) {
  const testsWaitingAnswer = new Map();
  let uuid = 1;

  let { options, configLocation } = cli;

  if ( configLocation && configLocation !== "pkg" ) {
    options = Object.assign( {}, require( configLocation ), options );
  }

  global.quaseUnit = { options };

  const runner = importFresh( "./index.js" ).runner;
  const firstErrors = [];

  [ "runStart", "testStart", "testEnd", "suiteStart", "suiteEnd", "runEnd", "otherError" ].forEach( eventType => {
    runner.on( eventType, arg => {
      send( eventType, arg );
    } );
  } );

  runner.on( "matchesSnapshot", ( { something, stack, fullname, deferred } ) => {
    const id = uuid++;
    testsWaitingAnswer.set( id, deferred );

    send( "matchesSnapshot", {
      byteArray: concordance.serialize(
        concordance.describe( something, runner.concordanceOptions )
      ),
      stack,
      fullname,
      id
    } );
  } );

  process.on( "message", ( { type, id, error } ) => {
    if ( type === "quase-unit-snap-result" ) {
      const deferred = testsWaitingAnswer.get( id );
      testsWaitingAnswer.delete( id );
      deferred.resolve( error );
    } else if ( type === "quase-unit-bail" ) {
      runner.failedOnce = true;
    }
  } );

  for ( const file of files ) {
    try {
      importFresh( file );
    } catch ( err ) {
      firstErrors.push( err );
    }
  }

  process.on( "uncaughtException", arg => {
    send( "otherError", arg );
  } );

  runner.once( "runStart", () => {
    for ( const err of firstErrors ) {
      send( "otherError", err );
    }
  } );

  runner.run();
}

process.on( "message", ( { type, cli, files } ) => {
  if ( type === "quase-unit-start" ) {
    try {
      start( cli, files );
    } catch ( err ) {
      send( "otherError", err );
    }
  } else if ( type === "quase-unit-exit" ) {
    process.channel.unref();
  }
} );
