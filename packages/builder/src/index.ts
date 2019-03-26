import { Options } from "./types";
import Builder from "./builder";
import HMRServer from "./hmr-server";

type IndexReturn = {
  builder: Builder;
  reporter: any;
};

export default function( options: Options, dontListenSigint?: boolean ): IndexReturn {
  let reporter;

  const builder = new Builder( options );
  const watcher = builder.watcher;

  const { plugin: Reporter, options: reporterOpts } = builder.reporter;

  if ( watcher ) {
    reporter = new Reporter( reporterOpts, builder );

    const hmrServer = builder.options.hmr ? new HMRServer( builder ) : null;
    if ( hmrServer ) {
      hmrServer.start().then( hmrOptions => {
        builder.hmrOptions = hmrOptions;
        watcher.start();
      } );
    } else {
      watcher.start();
    }

    if ( !dontListenSigint ) {
      process.once( "SIGINT", () => {
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
    builder
  };
}

export { Builder };

export { schema, handleOptions } from "./options";
