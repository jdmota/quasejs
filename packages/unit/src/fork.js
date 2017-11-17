const importFresh = require( "import-fresh" );
const CircularJSON = require( "circular-json" );

const onMessage = msg => {
  if ( msg.type === "quase-unit-start" ) {
    global.quaseUnit = { options: msg.options };

    const runner = importFresh( "./index.js" ).runner;

    [ "runStart", "testStart", "testEnd", "suiteStart", "suiteEnd", "runEnd", "postError" ].forEach( eventType => {
      runner.on( eventType, arg => {
        process.send( {
          type: "quase-unit-emit",
          eventType,
          arg: CircularJSON.stringify( arg, ( _, value ) => {
            if ( value instanceof Error ) {
              const obj = { stack: value.stack };
              for ( const key in value ) {
                obj[ key ] = value[ key ];
              }
              return obj;
            }
            return value;
          } )
        } );

        if ( eventType === "runEnd" ) {
          process.disconnect();
        }
      } );
    } );

    process.on( "uncaughtException", error => {
      process.send( {
        type: "quase-unit-emit",
        eventType: "postError",
        arg: error
      } );
    } );

    for ( const file of msg.files ) {
      importFresh( file );
    }

    runner.run();

  }
};

process.on( "message", onMessage );
