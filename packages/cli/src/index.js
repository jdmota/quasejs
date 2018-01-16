const path = require( "path" );
const chalk = require( "chalk" );
const hasYarn = require( "has-yarn" );
const updateNotifier = require( "update-notifier" );
const findUp = require( "find-up" );
const readPkgUp = require( "read-pkg-up" );
const pkgConf = require( "pkg-conf" );
const importLocal = require( "import-local" );
const loudRejection = require( "loud-rejection" );
const normalizePkg = require( "normalize-package-data" );
const minimist = require( "minimist" );
const camelcaseKeys = require( "camelcase-keys" );
const decamelize = require( "decamelize" );
const trimNewlines = require( "trim-newlines" );
const redent = require( "redent" );
const defaultsDeep = require( "lodash.defaultsdeep" );

function notifyFix( opts ) {
  if ( !process.stdout.isTTY || !this.update ) {
    return this;
  }

  opts = Object.assign( {}, opts );

  opts.isGlobal = opts.isGlobal === undefined ? opts.isGlobal : require( "is-installed-globally" );

  const defaultMsg = hasYarn() ?
    `Update available ${chalk.dim( this.update.current )}${chalk.reset( " → " )}${chalk.green( this.update.latest )}` +
    ` \nRun ${chalk.cyan( `yarn ${opts.isGlobal ? "global " : ""}add ${this.packageName}` )} to update` :
    `Update available ${chalk.dim( this.update.current )}${chalk.reset( " → " )}${chalk.green( this.update.latest )}` +
    ` \nRun ${chalk.cyan( `npm i ${opts.isGlobal ? "-g " : ""}${this.packageName}` )} to update`;

  opts.message = opts.message || defaultMsg;

  opts.boxenOpts = opts.boxenOpts || {
    padding: 1,
    align: "center",
    borderStyle: {
      topLeft: " ",
      topRight: " ",
      bottomLeft: " ",
      bottomRight: " ",
      horizontal: " ",
      vertical: " "
    }
  };

  const message = "\n" + require( "boxen" )( opts.message, opts.boxenOpts );

  /* eslint-disable */
  if ( opts.defer === false ) {
    console.error( message );
  } else {
    process.on( "exit", () => {
      console.error( message );
    } );

    process.on( "SIGINT", () => {
      console.error( "" );
      process.exit();
    } );
  }
  /* eslint-enable */

  return this;
}

function notify( pkg, notifierOpts ) {
  const notifier = updateNotifier( Object.assign( { pkg }, notifierOpts.options ) );
  notifier.notify = notifyFix;
  notifier.notify( notifierOpts.notify );
}

// Prevent caching of this module so module.parent is always accurate
delete require.cache[ __filename ];
const filename = module.parent.filename;
const parentDir = path.dirname( filename );

export function getConfig( opts ) {

  const { cwd, configFiles, configKey, failIfNotFound } = opts || {};
  const result = {
    config: undefined,
    location: undefined
  };

  if ( configFiles ) {
    const location = findUp.sync( configFiles, { cwd } );

    if ( location ) {
      try {
        result.config = require( location );
        result.location = location;
      } catch ( e ) {
        // Ignore
      }
    } else if ( failIfNotFound ) {
      throw new Error( `Config file was not found: ${configFiles.toString()}` );
    }
  }

  if ( !result.config ) {
    if ( configKey ) {
      try {
        result.config = pkgConf.sync( configKey, { cwd, skipOnFalse: true } );
        result.location = "pkg";
      } catch ( e ) {
        // Ignore
      }
    }
  }

  return result;
}

const DEFAULT = {};

const defaultOptions = {
  cwd: process.cwd(),
  argv: process.argv.slice( 2 ),
  inferType: true,
  autoHelp: true,
  autoVersion: true,
  schema: {}
};

export default function( callback, opts ) {
  /* eslint-disable no-process-exit, no-console */

  if ( importLocal( filename ) ) {
    return;
  }

  loudRejection();

  opts = defaultsDeep( {}, opts, defaultOptions );
  opts.cwd = path.resolve( opts.cwd );

  const minimistOpts = {
    string: [],
    boolean: [],
    alias: {},
    default: {},
    stopEarly: false,
    unknown: () => true,
    "--": true
  };

  if ( opts.configFiles ) {
    minimistOpts.string.push( "config" );
    minimistOpts.alias.c = "config";
  }

  if ( !opts.inferType ) {
    minimistOpts.string.push( "_" );
  }

  const defaults = {};

  for ( const k in opts.schema ) {
    const { type, alias, default: d } = opts.schema[ k ];
    defaults[ k ] = d;

    const key = decamelize( k, "-" );
    if ( type === "string" ) {
      minimistOpts.string.push( key );
      minimistOpts.default[ key ] = DEFAULT;
    } else if ( type === "boolean" ) {
      minimistOpts.boolean.push( key );
      minimistOpts.default[ key ] = DEFAULT;
      if ( d === undefined ) {
        defaults[ k ] = false;
      }
    }
    minimistOpts.alias[ alias ] = key;
  }

  const argv = minimist( opts.argv, minimistOpts );

  for ( const key in argv ) {
    if ( argv[ key ] === DEFAULT ) {
      delete argv[ key ];
    }
  }

  const pkg = opts.pkg ? opts.pkg : readPkgUp.sync( {
    cwd: parentDir,
    normalize: false
  } ).pkg;

  normalizePkg( pkg );

  let description;
  let help = redent( trimNewlines( ( opts.help || "" ).replace( /\t+\n*$/, "" ) ), 2 );

  process.title = pkg.bin ? Object.keys( pkg.bin )[ 0 ] : pkg.name;
  description = !opts.description && opts.description !== false ? pkg.description : opts.description;
  help = ( description ? `\n  ${description}\n` : "" ) + ( help ? `\n${help}\n` : "\n" );

  const showHelp = code => {
    console.log( help );
    process.exit( typeof code === "number" ? code : 2 );
  };

  const showVersion = () => {
    console.log( typeof opts.version === "string" ? opts.version : pkg.version );
    process.exit();
  };

  if ( argv.version && opts.autoVersion ) {
    showVersion();
  }

  if ( argv.help && opts.autoHelp ) {
    showHelp( 0 );
  }

  if ( opts.notifier !== false ) {
    notify( pkg, opts.notifier || {} );
  }

  const { config, location: configLocation } = getConfig( {
    cwd: opts.cwd,
    configFiles: argv.config || opts.configFiles,
    configKey: opts.configKey,
    failIfNotFound: !!argv.config
  } );

  const input = argv._;
  delete argv._;

  const flags = camelcaseKeys( argv, { exclude: [ "--", /^\w$/ ] } );

  const options = defaultsDeep( {}, flags, config, defaults );

  callback( {
    input,
    options,
    flags,
    config,
    configLocation,
    pkg,
    help,
    showHelp,
    showVersion
  } );
}
