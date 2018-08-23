import optionChain from "./util/option-chain";
import { GroupPlaceholder, TestPlaceholder } from "./placeholders";

function validateHelper( options, name, callback ) {

  if ( options.type !== "test" && options.type !== "group" ) {
    if ( options.serial ) {
      return "The `serial` modifier cannot be used with hooks.";
    }

    if ( options.exclusive ) {
      return "The `only` modifier cannot be used with hooks.";
    }

    if ( options.status === "failing" ) {
      return "The `failing` modifier cannot be used with hooks.";
    }

    if ( options.status === "todo" ) {
      return "The `todo` modifier is only for documentation of future tests and cannot be used with hooks.";
    }

    if ( options.allowNoPlan ) {
      return "The `allowNoPlan` modifier is not need for hooks.";
    }
  }

  if ( options.status !== "todo" && options.type !== "group" && typeof callback !== "function" ) {
    return "Expected an implementation.";
  }

  if ( options.strict ) {
    if (
      options.exclusive || options.status === "failing" ||
      options.status === "todo" || options.status === "skipped"
    ) {
      return "`only`, `failing`, `todo`, `skipped` modifiers are not allowed in strict mode.";
    }
  }

}

function validate( options, name, callback ) {
  const msg = validateHelper( options, name, callback );
  if ( msg ) {
    throw new Error( msg );
  }
}

function createTest( metadata, name, callback ) {

  const parent = this._current;

  if ( typeof name === "function" ) {
    callback = name;
    name = undefined;
  }

  const { metadata: parentMetadata } = parent;

  if ( parentMetadata && parentMetadata.strict ) {
    metadata.strict = true;
  }

  validate( metadata, name, callback );

  if ( parentMetadata ) {
    if ( metadata.type === "test" || metadata.type === "group" ) {
      if ( parentMetadata.status === "failing" ) {
        metadata.status = metadata.status || "failing";
      } else {
        metadata.status = parentMetadata.status || metadata.status;
      }
    }
    if ( parentMetadata.allowNoPlan ) {
      metadata.allowNoPlan = true;
    }
  }

  name = name || "anonymous";

  const placeholder = metadata.type === "group" ?
    new GroupPlaceholder( name, callback, metadata, parent ) :
    new TestPlaceholder( name, callback, metadata, parent );

  return placeholder.api;
}

function handleType( type ) {
  return data => {
    if ( data.type !== "test" ) {
      throw new Error( `Cannot use '${type}' and '${data.type}' together` );
    }
    data.type = type;
  };
}

const errors = {
  todo: "The `todo` modifier is only for documentation and cannot be used with skip, only, or failing.",
  onlyAndSkip: "`only` tests cannot be skipped."
};

const chain = {
  defaults: {
    type: "test",
    serial: false,
    exclusive: false,
    strict: false,
    status: "",
    allowNoPlan: false
  },
  methods: {
    test: handleType( "test" ),
    before: handleType( "before" ),
    after: handleType( "after" ),
    beforeEach: handleType( "beforeEach" ),
    afterEach: handleType( "afterEach" ),
    group: handleType( "group" ),
    strict: data => {
      data.strict = true;
    },
    serial: data => {
      data.serial = true;
    },
    only: data => {
      if ( data.status === "todo" ) {
        throw new Error( errors.todo );
      }
      if ( data.status === "skipped" ) {
        throw new Error( errors.onlyAndSkip );
      }
      data.exclusive = true;
    },
    skip: data => {
      if ( data.status === "todo" ) {
        throw new Error( errors.todo );
      }
      if ( data.exclusive ) {
        throw new Error( errors.onlyAndSkip );
      }
      data.status = "skipped";
    },
    todo: data => {
      if ( data.status === "failing" || data.status === "skipped" || data.exclusive ) {
        throw new Error( errors.todo );
      }
      data.status = "todo";
    },
    failing: data => {
      if ( data.status === "todo" ) {
        throw new Error( errors.todo );
      }
      data.status = "failing";
    },
    allowNoPlan: data => {
      data.allowNoPlan = true;
    }
  }
};

export function createTestChain( ctx ) {
  return optionChain( chain, createTest, ctx );
}

export function extendWithChain( clazz ) {
  return optionChain( chain, createTest, null, clazz.prototype );
}
