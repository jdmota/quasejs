import { PluginsRunner } from "../plugins/runner";
import { SentData } from "./farm";
import { encapsulate, revive } from "./serialization";

const {
  isMainThread, parentPort, workerData
} = require( "worker_threads" ); // eslint-disable-line

async function handle( runner: PluginsRunner, { id, method, args: _args }: SentData ) {
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

  parentPort.on( "message", ( data: "die" | SentData ) => {
    if ( data === "die" ) {
      parentPort.removeAllListeners();
    } else {
      handle( runner, data );
    }
  } );
}
