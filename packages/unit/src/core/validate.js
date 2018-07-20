function validate( name, callback, options ) {

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

  if ( options.status === "todo" ) {

    if ( options.status === "skipped" || options.status === "failing" || options.exclusive ) {
      return "The `todo` modifier is only for documentation and cannot be used with skip, only, or failing.";
    }

  } else if ( options.type !== "group" && typeof callback !== "function" ) {

    return "Expected an implementation.";

  }

  if ( options.status === "skipped" ) {
    if ( options.exclusive ) {
      return "`only` tests cannot be skipped.";
    }

    if ( options.status === "failing" ) {
      return "`failing` tests cannot be skipped.";
    }
  }

  if ( options.strict ) {
    if ( options.exclusive || options.status === "failing" || options.status === "todo" || options.status === "skipped" ) {
      return "`only`, `failing`, `todo`, `skipped` modifiers are not allowed in strict mode.";
    }
  }

}

export default function( name, callback, options ) {
  let msg = validate( name, callback, options );
  if ( msg ) {
    throw new Error( msg );
  }
}
