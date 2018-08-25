import defer from "./core/util/defer";
import { processError } from "./core/process-error";
import SnapshotsManager from "./snapshots";
import whyIsNodeRunning, { enable as enableAsyncHooks } from "./why-is-node-running";

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

async function saveSnapshots( snapshotManagers ) {
  const promises = [];

  for ( const manager of snapshotManagers.values() ) {
    promises.push( manager.save() );
  }

  const stats = await Promise.all( promises );
  const finalStat = {
    added: 0,
    updated: 0,
    removed: 0,
    obsolete: 0
  };

  for ( const stat of stats ) {
    finalStat.added += stat.added;
    finalStat.updated += stat.updated;
    finalStat.removed += stat.removed;
    finalStat.obsolete += stat.obsolete;
  }

  return finalStat;
}

function start( cli, files ) {
  const snapshotManagers = new Map();
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
      if ( eventType === "runEnd" ) {
        saveSnapshots( snapshotManagers ).then( stats => {
          arg.snapshotStats = stats;
          arg.whyIsRunning = whyIsNodeRunning();
          send( eventType, arg );

          if ( arg.whyIsRunning.length === 0 ) {
            process.channel.unref();
          }
        } );
      } else {
        send( eventType, arg );
      }
    } );
  } );

  options = runner.options;

  runner.on( "matchesSnapshot", async( { something, stack, key, deferred } ) => {
    const id = uuid++;
    const answerDefer = defer();
    testsWaitingAnswer.set( id, answerDefer );

    process.send( {
      type: "quase-unit-source",
      stack,
      id
    } );

    const { file, line, column } = await answerDefer.promise;

    let manager = snapshotManagers.get( file );
    if ( !manager ) {
      manager = new SnapshotsManager(
        process.cwd(),
        file,
        options.snapshotDir,
        options.updateSnapshots,
        options.concordanceOptions
      );
      snapshotManagers.set( file, manager );
    }

    let error;

    try {
      manager.matchesSnapshot(
        key,
        `${key} (${line}:${column})`,
        something
      );
    } catch ( e ) {
      error = processError( e, stack, options.concordanceOptions );
    }

    deferred.resolve( error );
  } );

  process.on( "message", ( { type, id, source } ) => {
    if ( type === "quase-unit-source" ) {
      const deferred = testsWaitingAnswer.get( id );
      testsWaitingAnswer.delete( id );
      deferred.resolve( source );
    } else if ( type === "quase-unit-bail" ) {
      runner.failedOnce = true;
    } else if ( type === "quase-unit-sigint" ) {
      runner.sentSigint = true;
    } else if ( type === "quase-unit-ping" ) {
      process.send( {
        type: "quase-unit-why-is-running",
        whyIsRunning: whyIsNodeRunning()
      } );
    }
  } );

  enableAsyncHooks();

  for ( const file of files ) {
    try {
      importFresh( file );
    } catch ( err ) {
      firstErrors.push( err );
    }
  }

  process.on( "uncaughtException", arg => {
    runner.otherError( arg );
  } );

  runner.once( "runStart", () => {
    for ( const err of firstErrors ) {
      runner.otherError( err );
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
  }
} );

process.on( "SIGINT", () => {
  // Catch
} );
