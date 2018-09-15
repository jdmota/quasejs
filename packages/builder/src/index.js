import Builder from "./builder";
import HMRServer from "./hmr-server";

const EventEmitter = require( "events" );

export default function( options, dontListenSigint ) {
  let reporter, emitter;

  const builder = new Builder(
    options,
    w => emitter.emit( "warning", w )
  );

  const { plugin: Reporter, options: reporterOpts } = builder.reporter;

  if ( builder.watcher ) {
    emitter = builder.watcher;
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

    if ( !dontListenSigint ) {
      process.once( "SIGINT", function() {
        emitter.emit( "sigint" );
        emitter.stop();
        if ( hmrServer ) {
          hmrServer.stop();
        }
      } );
    }
  } else {
    emitter = new EventEmitter();
    reporter = new Reporter( reporterOpts, builder, emitter );

    emitter.emit( "build-start" );
    builder.runBuild().then(
      o => emitter.emit( "build-success", o ),
      e => emitter.emit( "build-error", e )
    ).then( () => {
      builder.stop();
    } );
  }
  return reporter;
}

export { Builder };

export { schema } from "./options";
