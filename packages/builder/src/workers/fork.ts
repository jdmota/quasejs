import { PluginsRunnerInWorker } from "../plugins/worker-runner";
import { UserConfig } from "../builder/user-config";
import { SentData } from "./farm";

const {
  isMainThread, parentPort, workerData
} = require( "worker_threads" ); // eslint-disable-line

if ( isMainThread ) {
  throw new Error( "This file should only be loaded by workers" );
}

const runnerInit = ( async() => {
  const runner = new PluginsRunnerInWorker( new UserConfig( workerData ) );
  await runner.init();
  return runner;
} )();

async function runMethod( runner: PluginsRunnerInWorker, method: SentData[ "method" ], args: any[] ) {
  if ( method === "pipeline" ) {
    return runner.pipeline( args[ 0 ], args[ 1 ] );
  }
  if ( method === "renderAsset" ) {
    return runner.renderAsset( args[ 0 ], args[ 1 ] );
  }
  throw new Error( `Worker: No method ${method}` );
}

async function handle( { id, method, args }: SentData ) {
  try {
    const runner = await runnerInit;
    const result = await runMethod( runner, method, args );
    parentPort.postMessage( {
      id,
      result
    } );
  } catch ( error ) {
    parentPort.postMessage( {
      id,
      error: {
        message: error.message,
        stack: error.stack
      }
    } );
  }
}

parentPort.on( "message", ( data: "die" | SentData ) => {
  if ( data === "die" ) {
    parentPort.removeAllListeners();
  } else {
    handle( data );
  }
} );
