import Builder from "./builder";
import Watcher from "./watcher";

const { printError } = require( "@quase/config" );
const EventEmitter = require( "events" );

function run( options ) {
  let reporter, emitter;
  options = options || {};
  options.warn = options.warn || ( w => emitter.emit( "warning", w ) );

  const builder = new Builder( options );
  const { plugin: Reporter, options: reporterOpts } = builder.reporter;

  if ( builder.watch ) {
    emitter = new Watcher( builder );
    reporter = new Reporter( reporterOpts, builder, emitter );
    emitter.start();
  } else {
    emitter = new EventEmitter();
    reporter = new Reporter( reporterOpts, builder, emitter );
    emitter.emit( "build-start" );
    builder.build().then(
      o => emitter.emit( "build", o ),
      e => emitter.emit( "build-error", e )
    );
  }
  return reporter;
}

export default function( options ) {
  try {
    return run( options );
  } catch ( e ) {
    printError( e );
  }
}

export { Builder, Watcher };
