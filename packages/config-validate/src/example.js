import { getType, checkType, validate, printError } from ".";

const options = {
  deprecated: true,
  config: 20,
  simil: 10,
};

const schema = {
  config: {
    type: "string",
    alias: "c",
    default: "config.js"
  },
  deprecated: {
    deprecated: true
  },
  similar: {}
};

try {
  validate( options, schema );
  checkType( "similar", getType( options.similar ), "array", [] );
} catch ( e ) {
  printError( e );
}

// yarn node packages/config-validate/src/example
