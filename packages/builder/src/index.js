import Builder from "./builder";
import Watcher from "./watcher";

const EventEmitter = require( "events" );

export default function( options ) {
  let reporter, emitter;
  options = options || {};
  options.warn = options.warn || ( w => emitter.emit( "warning", w ) );

  const builder = new Builder( options );
  const Reporter = builder.reporter;

  if ( builder.watch ) {
    emitter = new Watcher( builder );
    reporter = new Reporter( builder, emitter );
    emitter.start();
  } else {
    emitter = new EventEmitter();
    reporter = new Reporter( builder, emitter );
    emitter.emit( "build-start" );
    builder.build().then(
      o => emitter.emit( "build", o ),
      e => emitter.emit( "build-error", e )
    );
  }
  return reporter;
}

export { Builder, Watcher };
