import NodeReporter from "../reporters/node";
import { assertTimeout } from "./util/assert-args";
import { color as concordanceOptions, plain as plainConcordanceOptions } from "./concordance-options";
import randomizer from "./random";

const { ValidationError, getType, checkType } = require( "@quase/config" );
const { getOnePlugin } = require( "@quase/get-plugins" );
const { supportsColor } = require( "chalk" );
const isCi = require( "is-ci" );
const os = require( "os" );

function arrify( val ) {
  if ( val == null ) {
    return [];
  }
  return Array.isArray( val ) ? val : [ val ];
}

export default function( options ) {
  if ( options.inspect || options.inspectBrk ) {
    if ( options.debug ) {
      throw new ValidationError( `You cannot use "debug" with --inspect or --inspect-brk` );
    }
    if ( options.concurrency != null && options.concurrency !== 1 ) {
      throw new ValidationError( `You cannot use "concurrency" with --inspect or --inspect-brk` );
    }
  }

  if ( options.forceSerial ) {
    if ( options.concurrency != null && options.concurrency !== 1 ) {
      throw new ValidationError( `You cannot use "concurrency" with --force-serial` );
    }
  }

  options.concurrency = ( options.concurrency > 0 && options.concurrency ) || Math.min( os.cpus().length, isCi ? 2 : Infinity );
  options.color = options.color === undefined ? supportsColor : !!options.color;

  if ( options.inspect || options.inspectBrk || options.forceSerial ) {
    options.concurrency = 1;
  }

  checkType( "concurrency", getType( options.concurrency ), "number" );

  options.randomizer = options.random && randomizer( options.random );
  options.random = options.randomizer && options.randomizer.hex;
  options.timeouts = !!( options.timeouts === undefined || options.timeouts );

  if ( options.debug ) {
    options.timeouts = false;
  }

  if ( options.timeout == null ) {
    options.timeout = 0;
  } else {
    checkType( "timeout", getType( options.timeout ), "number" );
    assertTimeout( options.timeout );
  }

  if ( options.slow == null ) {
    options.slow = 0;
  } else {
    checkType( "slow", getType( options.slow ), "number" );
  }

  if ( options.stackIgnore ) {
    if ( typeof options.stackIgnore === "string" ) {
      options.stackIgnore = new RegExp( options.stackIgnore );
    } else {
      checkType( "stackIgnore", getType( options.stackIgnore ), "regexp" );
    }
  }

  options.reporter = options.reporter ? getOnePlugin( options.reporter ).plugin : NodeReporter;
  checkType( "reporter", getType( options.reporter ), "function" );

  options.env = options.env ? getOnePlugin( options.env ).plugin : {};
  checkType( "env", getType( options.env ), "object" );

  options.concordanceOptions =
    options.concordanceOptions ? getOnePlugin( options.concordanceOptions ).plugin : ( options.color ? concordanceOptions : plainConcordanceOptions );
  checkType( "concordanceOptions", getType( options.concordanceOptions ), "object" );

  options.assertions = ( options.assertions || [] ).map( a => getOnePlugin( a ).plugin );

  options.files = arrify( options.files );
  options.match = arrify( options.match );
  options.globals = arrify( options.globals );
  options.updateSnapshots = !!options.updateSnapshots;
  options.bail = !!options.bail;
  options.strict = !!options.strict;
  options.allowNoPlan = !!options.allowNoPlan;
  options.forceSerial = !!options.forceSerial;
  options.logHeapUsage = !!options.logHeapUsage;

  return options;
}
