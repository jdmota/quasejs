function validate( name, callback, options, strict ) {

  if ( options.fastBail && options.type !== "group" ) {
    return "fastBail modifier is only available for groups.";
  }

  if ( options.type !== "test" && options.type !== "group" ) {
    if ( options.serial ) {
      return "The `serial` modifier cannot be used with hooks.";
    }

    if ( options.exclusive ) {
      return "The `only` modifier cannot be used with hooks.";
    }

    if ( options.failing ) {
      return "The `failing` modifier cannot be used with hooks.";
    }

    if ( options.todo ) {
      return "The `todo` modifier is only for documentation of future tests and cannot be used with hooks.";
    }
  }

  if ( options.todo ) {

    if ( options.skipped || options.failing || options.exclusive ) {
      return "The `todo` modifier is only for documentation and cannot be used with skip, only, or failing.";
    }

  } else if ( options.type !== "group" && typeof callback !== "function" ) {

    return "Expected an implementation.";

  }

  if ( options.skipped ) {
    if ( options.exclusive ) {
      return "`only` tests cannot be skipped.";
    }

    if ( options.failing ) {
      return "`failing` tests cannot be skipped.";
    }
  }

  if ( strict ) {
    if ( options.exclusive || options.failing || options.todo || options.skipped ) {
      return "`only`, `failing`, `todo`, `skipped` modifiers are not allowed in strict mode.";
    }
  }

}

export default function( name, callback, options, strict ) {
  let msg = validate( name, callback, options, strict );
  if ( msg ) {
    throw new Error( msg );
  }
}
