import { PluginsRunner } from "../plugins/runner";
import { encapsulate, revive } from "./serialization";

const {
  isMainThread, parentPort, workerData
} = require( "worker_threads" ); // eslint-disable-line

async function handle( runner, { id, method, args: _args } ) {
  const fn = runner[ method ];
  const args = _args.map( x => revive( x ) );

  if ( fn ) {
    try {
      const result = await runner[ method ]( ...args );
      parentPort.postMessage( {
        id,
        result: encapsulate( result )
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
  } else {
    parentPort.postMessage( {
      id,
      error: {
        message: `Worker: No method ${method}`,
        stack: ""
      }
    } );
  }
}

if ( !isMainThread ) {
  const runner = new PluginsRunner();
  runner.init( workerData );

  parentPort.on( "message", data => {
    if ( data === "die" ) {
      parentPort.removeAllListeners();
    } else {
      handle( runner, data );
    }
  } );
}
