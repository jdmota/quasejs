import Builder from "./builder";
import HMRServer from "./hmr-server";

export default function( options, dontListenSigint ) {
  let reporter;

  const builder = new Builder( options );

  const { plugin: Reporter, options: reporterOpts } = builder.reporter;

  if ( builder.watcher ) {
    reporter = new Reporter( reporterOpts, builder );

    const hmrServer = builder.options.hmr ? new HMRServer( builder ) : null;
    if ( hmrServer ) {
      hmrServer.start().then( hmrOptions => {
        builder.hmrOptions = hmrOptions;
        builder.watcher.start();
      } );
    } else {
      builder.watcher.start();
    }

    if ( !dontListenSigint ) {
      process.once( "SIGINT", function() {
        builder.emit( "sigint" );
        builder.stop();
        if ( hmrServer ) {
          hmrServer.stop();
        }
      } );
    }
  } else {
    reporter = new Reporter( reporterOpts, builder );

    builder.emit( "build-start" );
    builder.runBuild().then(
      o => builder.emit( "build-success", o ),
      e => builder.emit( "build-error", e )
    ).then( () => {
      builder.stop();
    } );
  }
  return {
    reporter,
    builder,
    watcher: builder.watcher
  };
}

export { Builder };

export { schema } from "./options";
