import { validate } from ".";

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

validate( options, schema, checker => {
  // More checks...
  checker.checkType( "similar", checker.getType( checker.config.similar ), "array", [] );
} );

// yarn node packages/config-validate/src/example
