import GlobalEnv from "./global-env";
import Runner from "./runner";
import AssertionError from "./assertion-error";
import Node from "./reporters/node";
import skipReasons from "./skip-reasons";

const description = `Runs tests using quase/unit.
  Files should be a space-separated list of file/directory paths and/or glob
  expressions. Defaults to 'test/**/*.js'.`;

export default {
  skipReasons: Object.assign( {}, skipReasons ),
  Runner,
  reporters: {
    Node
  },
  AssertionError,
  GlobalEnv,
  cli( program ) {

    program.usage( "[options] [files]" )
      .description( description )
      .option( "-f, --filter <filter>", "filter which tests run" )
      .option( "-r, --reporter <name>", "specify the reporter to use; if no match is found a list of available reporters will be displayed" )
      .option( "--seed [value]", "specify a seed to order your tests; if option is specified without a value, one will be generated" )
      .option( "-w, --watch", "Watch files for changes and re-run the test suite" );

    return function( args, opts ) {
      // TODO
      // const runner = Runner.init().setup();
      console.log( "Unit: ", args, opts );
    };

  }
};
