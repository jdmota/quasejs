import { createValidator } from ".";

const validator = createValidator( ( config, c ) => {

  c.checkDeprecated( "deprecated" );

  c.checkUnrecognized( [ "config", "deprecated", "similar" ] );

  c.checkType( "config", "config.js" );

} );

validator( {
  deprecated: true,
  config: 10,
  // simil: 10,
} );

// yarn node packages/config-validate/src/example
