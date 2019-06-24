import defer from "../core/util/defer";
import SnapshotsManager from "../snapshots";
import whyIsNodeRunning, { enable as enableAsyncHooks } from "./why-is-node-running";
import { CoreRunnerEvents, RunnerToChildEvents, ChildEvents, CoreRunnerEventTypes, Deferred, EventAskSourceContent, NormalizedOptions } from "../types";

const send = ( () => {
  if ( process.send ) {
    const send = process.send.bind( process );
    return ( msg: ChildEvents ) => send( msg );
  }
  throw new Error( `process.send not available` );
} )();

function sendEvent( eventType: CoreRunnerEventTypes, arg: unknown ) {
  send( {
    type: "quase-unit-emit",
    eventType,
    arg: stringify( arg )
  } );
}

process.on( "uncaughtException", err => {
  sendEvent( "otherError", err );
} );

const importFresh = require( "import-fresh" );
const CircularJSON = require( "circular-json" );

function stringify( arg: unknown ) {
  return CircularJSON.stringify( arg, ( _: any, value: any ) => {
    if ( value instanceof Error ) {
      const obj: any = {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
      for ( const key in value ) {
        obj[ key ] = ( value as any )[ key ];
      }
      return obj;
    }
    if ( value instanceof Buffer ) {
      return Array.from( value );
    }
    return value;
  } );
}

async function saveSnapshots( snapshotManagers: Map<string, SnapshotsManager> ) {
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

function start( options: NormalizedOptions, files: string[] ) {
  const snapshotManagers: Map<string, SnapshotsManager> = new Map();
  const testsWaitingAnswer: Map<number, Deferred<EventAskSourceContent>> = new Map();
  let uuid = 1;

  if ( options.configLocation && !/(\\|\/)package\.json$/.test( options.configLocation ) ) {
    options = Object.assign( {}, require( options.configLocation ), options );
  }

  const g = global as any;
  g.quaseUnit = { _fork: true, options };

  const runner = importFresh( "../index.js" ).runner;
  const firstErrors: Error[] = [];
  const eventTypes: CoreRunnerEventTypes[] = [ "runStart", "testStart", "testEnd", "suiteStart", "suiteEnd", "runEnd", "otherError" ];

  eventTypes.forEach( eventType => {
    runner.on( eventType, ( arg: CoreRunnerEvents ) => {
      if ( arg.type === "runEnd" ) {
        saveSnapshots( snapshotManagers ).then( stats => {
          arg.snapshotStats = stats;
          arg.whyIsRunning = whyIsNodeRunning();
          sendEvent( eventType, arg );

          if ( arg.whyIsRunning.length === 0 ) {
            ( process as any ).channel.unref();
          }
        } ).catch( err => {
          sendEvent( "otherError", err );
        } );
      } else {
        sendEvent( eventType, arg );
      }
    } );
  } );

  options = runner.options;

  runner.on( "matchesSnapshot", async(
    { something, stack, key, deferred }: {
      something: unknown;
      stack: string;
      key: string;
      deferred: Deferred<void>;
    }
  ) => {
    const id = uuid++;
    const answerDefer = defer<EventAskSourceContent>();
    testsWaitingAnswer.set( id, answerDefer );

    send( {
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
        options.snapshotLocation,
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
      error = runner.processError( e, stack );
    }

    deferred.resolve( error );
  } );

  process.on( "message", ( evt: RunnerToChildEvents ) => {
    if ( evt.type === "quase-unit-source" ) {
      const deferred = testsWaitingAnswer.get( evt.id );
      if ( !deferred ) {
        throw new Error( "Assertion error" );
      }
      testsWaitingAnswer.delete( evt.id );
      deferred.resolve( evt.source );
    } else if ( evt.type === "quase-unit-bail" ) {
      runner.failedOnce = true;
    } else if ( evt.type === "quase-unit-sigint" ) {
      runner.sentSigint = true;
    } else if ( evt.type === "quase-unit-ping" ) {
      send( {
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
      firstErrors.push( err as Error );
    }
    send( {
      type: "quase-unit-file-imported",
      file
    } );
  }

  runner.once( "runStart", () => {
    for ( const err of firstErrors ) {
      runner.otherError( err );
    }
  } );

  runner.run();
}

process.on( "message", ( evt: RunnerToChildEvents ) => {
  if ( evt.type === "quase-unit-start" ) {
    try {
      start( evt.options, evt.files );
    } catch ( err ) {
      sendEvent( "otherError", err );
    }
  }
} );

process.on( "SIGINT", () => {
  // Catch
} );
