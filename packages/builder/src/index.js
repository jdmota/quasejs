import Builder from "./builder";
import Watcher from "./watcher";
import HMRServer from "./hmr-server";

const EventEmitter = require( "events" );

export default function( options ) {
  let reporter, emitter;

  const builder = new Builder(
    options,
    w => emitter.emit( "warning", w )
  );

  const { plugin: Reporter, options: reporterOpts } = builder.reporter;

  if ( builder.watch ) {
    emitter = new Watcher( builder );
    reporter = new Reporter( reporterOpts, builder, emitter );

    const hmrServer = builder.options.hmr ? new HMRServer( emitter ) : null;
    if ( hmrServer ) {
      hmrServer.start().then( hmrOptions => {
        builder.hmrOptions = hmrOptions;
        emitter.start();
      } );
    } else {
      emitter.start();
    }

    process.on( "SIGINT", function() {
      emitter.emit( "sigint" );
      emitter.stop();
      if ( hmrServer ) {
        hmrServer.stop();
      }
    } );
  } else {
    emitter = new EventEmitter();
    reporter = new Reporter( reporterOpts, builder, emitter );

    emitter.emit( "build-start" );
    builder.build().then(
      o => emitter.emit( "build-success", o ),
      e => emitter.emit( "build-error", e )
    );
  }
  return reporter;
}

export { Builder, Watcher };

export { schema } from "./options";
