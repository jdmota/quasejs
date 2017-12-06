import NodeReporter from "../reporters/node";
import { assertTimeout, assertNumber } from "./util/assert-args";
import { color as concordanceOptions, plain as plainConcordanceOptions } from "./concordance-options";
import requirePlugin from "./util/require-plugin";
import randomizer from "./random";

const os = require( "os" );
const isCi = require( "is-ci" );

function arrify( val ) {
  if ( val == null ) {
    return [];
  }
  return Array.isArray( val ) ? val : [ val ];
}

export default function( options ) {
  if ( options.inspect || options.inspectBrk ) {
    if ( options.debug ) {
      throw new Error( `You cannot use "debug" with --inspect or --inspect-brk` );
    }
    if ( options.concurrency != null && options.concurrency !== 1 ) {
      throw new Error( `You cannot use "concurrency" with --inspect or --inspect-brk` );
    }
  }

  if ( options.forceSerial ) {
    if ( options.concurrency != null && options.concurrency !== 1 ) {
      throw new Error( `You cannot use "concurrency" with --force-serial` );
    }
  }

  options.concurrency = ( options.concurrency > 0 && options.concurrency ) || Math.min( os.cpus().length, isCi ? 2 : Infinity );
  options.color = options.color === undefined ? true : !!options.color;

  if ( options.inspect || options.inspectBrk || options.forceSerial ) {
    options.concurrency = 1;
  }

  options.randomizer = options.random && randomizer( options.random );
  options.random = options.randomizer && options.randomizer.hex;
  options.reporter = requirePlugin( options.reporter, NodeReporter, "function", "reporter" );
  options.env = requirePlugin( options.env, null, "object", "environment" );
  options.concordanceOptions = requirePlugin(
    options.concordanceOptions,
    options.color ? concordanceOptions : plainConcordanceOptions,
    "object",
    "concordance options"
  );

  if ( options.timeout == null ) {
    options.timeout = 0;
  } else {
    assertTimeout( options.timeout );
  }

  if ( options.slow == null ) {
    options.slow = 0;
  } else {
    assertNumber( options.slow );
  }

  options.files = arrify( options.files );
  options.match = arrify( options.match );
  options.globals = !!options.globals;
  options.updateSnapshots = !!options.updateSnapshots;
  options.bail = !!options.bail;
  options.strict = !!options.strict;
  options.allowNoPlan = !!options.allowNoPlan;
  options.forceSerial = !!options.forceSerial;

  return options;
}
