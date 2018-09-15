import { PluginsRunner } from "../plugins/runner";
import typeson from "./typeson";

async function handle( runner, { id, method, args: _args } ) {
  const fn = runner[ method ];
  const args = _args.map( x => typeson.revive( x ) );

  if ( fn ) {
    try {
      const result = await runner[ method ]( ...args );
      process.send( {
        id,
        result: typeson.encapsulate( result )
      } );
    } catch ( error ) {
      process.send( {
        id,
        error: {
          message: error.message,
          stack: error.stack
        }
      } );
    }
  } else {
    process.send( {
      id,
      error: {
        message: `Worker: No method ${method}`,
        stack: ""
      }
    } );
  }
}

if ( process.send ) {
  const runner = new PluginsRunner();

  process.on( "message", data => {
    if ( data === "die" ) {
      process.removeAllListeners();
      process.channel.unref();
      return;
    }
    handle( runner, data );
  } );
}
