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

const onMessage = msg => {
  if ( msg.type === "quase-unit-start" ) {
    global.quaseUnit = { options: msg.options };

    const runner = importFresh( "./index.js" ).runner;

    [ "runStart", "testStart", "testEnd", "suiteStart", "suiteEnd", "runEnd", "postError" ].forEach( eventType => {
      runner.on( eventType, arg => {
        process.send( {
          type: "quase-unit-emit",
          eventType,
          arg: stringify( arg )
        } );

        if ( eventType === "runEnd" ) {
          process.disconnect();
        }
      } );
    } );

    process.on( "uncaughtException", arg => {
      process.send( {
        type: "quase-unit-emit",
        eventType: "postError",
        arg: stringify( arg )
      } );
    } );

    for ( const file of msg.files ) {
      try {
        importFresh( file );
      } catch ( arg ) {
        process.send( {
          type: "quase-unit-emit",
          eventType: "postError",
          arg: stringify( arg )
        } );
      }
    }

    runner.run();

  }
};

process.on( "message", onMessage );
