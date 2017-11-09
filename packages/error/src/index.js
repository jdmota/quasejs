const stackParser = require( "error-stack-parser" );
const { prettify } = require( "@quase/path-url" );

const ignoreStackTraceRe = /StackTrace\$\$|ErrorStackParser\$\$|StackTraceGPS\$\$|StackGenerator\$\$/;
const ignoreFileRe = /^([^()\s]*\/node_modules\/quase[^()\s]+|[^()\s\\/]+\.js|internal\/[^()\s\\/]+\/[^()\s\\/]+\.js|native)$/;

export async function beautify( originalStack, extractor ) {

  const frames = stackParser.parse( { stack: originalStack } ).filter( ( { fileName, functionName } ) => {
    return !ignoreFileRe.test( fileName ) && !ignoreStackTraceRe.test( functionName || "" );
  } );

  const promises = frames.map( async( { fileName, functionName, args, lineNumber, columnNumber } ) => {

    const stackLine = {
      textLine: `${functionName}${args ? `(${args.join( ", " )})` : ""}`,
      file: fileName,
      code: null,
      line: lineNumber,
      column: columnNumber
    };

    try {
      const pos = await extractor.getOriginalLocation( stackLine.file, { line: stackLine.line, column: stackLine.column } );
      if ( pos.line == null ) {
        stackLine.code = pos.code;
      } else {
        stackLine.file = pos.originalFile;
        stackLine.code = pos.originalCode;
        stackLine.line = pos.line;
        stackLine.column = pos.column;
      }
    } catch ( e ) {
      // Ignore
    }

    return stackLine;

  } );

  const cleaned = await Promise.all( promises );
  const cleanedText = cleaned.map( ( { textLine, file, line, column } ) => ( `${textLine} (${prettify( file )}:${line}:${column})` ) );

  const title = originalStack.split( "\n" ).shift();
  const lines = cleanedText.map( x => `    ${x}` ).join( "\n" );
  const stack = `${title}\n${lines}`;

  const first = cleaned[ 0 ];

  return {
    stack,
    source: first && first.file ? first : null
  };
}

export function getStack( offset ) {
  let error = new Error();

  // Not all browsers generate the `stack` property
  // Safari <=7 only, IE <=10 - 11 only
  /* istanbul ignore if */
  if ( !error.stack ) {
    try {
      throw error;
    } catch ( err ) {
      error = err;
    }
  }

  const arr = error.stack.split( "\n" );
  arr.splice( 1, offset || 1 );
  return arr.join( "\n" );
}

let installed = false;
let prevPrepareStack;
let prevExtension;

function stripBOM( content ) {
  if ( content.charCodeAt( 0 ) === 0xFEFF ) {
    content = content.slice( 1 );
  }
  return content;
}

export function install( extractor ) {
  if ( !installed ) {
    installed = true;

    prevPrepareStack = Error.prepareStackTrace;
    Error.prepareStackTrace = function( error ) {
      return beautify( error.stack, extractor );
    };

    if ( typeof require === "function" ) {
      const Module = require( "module" );
      prevExtension = Module._extensions[ ".js" ];
      Module._extensions[ ".js" ] = function( module, filename ) {
        const content = extractor.fs.getFileSync( filename );
        module._compile( stripBOM( content ), filename );
      };
    }
  }
}

export function uninstall() {
  if ( installed ) {
    Error.prepareStackTrace = prevPrepareStack;
    if ( prevExtension ) {
      const Module = require( "module" );
      Module._extensions[ ".js" ] = prevExtension;
    }
    prevPrepareStack = undefined;
    prevExtension = undefined;
    installed = false;
  }
}
