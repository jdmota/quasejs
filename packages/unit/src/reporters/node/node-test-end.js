import colors from "./colors";

const codeFrameColumns = require( "babel-code-frame" ).codeFrameColumns;
const SourceMapExtractor = require( require.resolve( "@quase/source-map" ).replace( "index.js", "extractor.js" ) ).default;
const FileSystem = require( "@quase/memory-fs" ).default;
const { prettify } = require( "@quase/path-url" );
const { beautify: beautifyStack } = require( "@quase/error" );

const extractor = new SourceMapExtractor( new FileSystem() ); // TODO move to reporter

async function enhanceError( original ) {

  const err = {
    actual: null,
    expected: null,
    diff: original.diff,
    stack: null,
    source: null,
    message: original.message
  };

  // Prevent memory leaks
  original.actual = null;
  original.expected = null;

  if ( original.stack ) {
    const { stack, source } = await beautifyStack( original.stack, extractor );
    err.stack = stack;
    err.source = source;
  }

  return err;
}

function indentString( str, indent ) {
  indent = indent || 2;
  return str.replace( /^(?!\s*$)/mg, typeof indent === "number" ? " ".repeat( indent ) : indent );
}

const legend = colors.removed ? `${colors.removed( "- Expected" )} ${colors.added( "+ Actual" )}` : "";

function showSource( source ) {

  const { file, code, line } = source;

  if ( !file || !code ) {
    return "";
  }

  return colors.errorStack( prettify( file ) ) + "\n\n" + codeFrameColumns( code, { start: { line } } ) + "\n\n";
}

function logSkipReason( text ) {
  process.stdout.write( indentString( `\nSkip reason: ${text}\n\n`, 4 ) );
}

export async function logError( e ) {

  const error = await enhanceError( e );
  let log = "\n";

  if ( error.message ) {
    log += colors.title( error.message ) + "\n";
  }

  if ( error.source ) {
    log += showSource( error.source );
  }

  if ( error.diff ) {
    log += `${legend}\n\n${indentString( error.diff )}\n\n`;
  }

  if ( error.stack ) {
    log += colors.errorStack( error.stack ) + "\n\n";
  }

  process.stdout.write( indentString( log, 4 ) );

}

export async function testEnd( { fullname, status, skipReason, errors, runtime, slow } ) {

  if ( status === "passed" && !slow ) {
    return;
  }

  const statusText = status === "failed" ? colors.error( status ) : status === "passed" ? colors.pass( status ) : colors.skip( status );

  process.stdout.write(
    indentString( `\n${colors.title( fullname.join( " > " ) )}\n${statusText} | ${runtime} ms ${slow ? colors.slow( "Slow!" ) : ""}\n` )
  );

  if ( skipReason ) {
    logSkipReason( skipReason );
  }

  for ( let i = 0; i < errors.length; i++ ) {
    await logError( errors[ i ] ); // eslint-disable-line no-await-in-loop
  }

  process.stdout.write( "\n" );

}
