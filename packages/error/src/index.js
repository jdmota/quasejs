const stackParser = require( "error-stack-parser" );
const { slash, prettify } = require( "@quase/path-url" );

export const ignoreStackTraceRe = /StackTrace\$\$|ErrorStackParser\$\$|StackTraceGPS\$\$|StackGenerator\$\$/;
export const ignoreFileRe = /^([^()\s]*\/quasejs\/packages\/[^()\s/]+\/dist\/[^()\s]*|[^()\s]*\/node_modules\/@quase\/[^()\s]+|[^()\s/]+\.js|internal(\/[^()\s/]+)?\/[^()\s]+\.js|native)$/;

export async function beautify( originalStack, extractor, options ) {

  const ignore = options && options.ignore;

  const frames = stackParser.parse( { stack: originalStack } ).filter( ( { fileName, functionName } ) => {
    const file = slash( fileName );
    if ( ignore && ignore.test( file ) ) {
      return false;
    }
    return !ignoreFileRe.test( file ) && !ignoreStackTraceRe.test( functionName || "" );
  } );

  const promises = frames.map( async( { fileName, functionName, args, lineNumber, columnNumber } ) => {

    const stackLine = {
      textLine: "",
      file: fileName,
      code: null,
      name: functionName,
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
        stackLine.name = pos.name || stackLine.name;
        stackLine.line = pos.line;
        stackLine.column = pos.column;
      }
    } catch ( e ) {
      // Ignore
    }

    stackLine.textLine = `${stackLine.name}${args ? `(${args.join( ", " )})` : ""}`;
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
  // source: ?{ file, code, name, line, column }
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
  arr.splice( 1, offset > 1 ? offset : 1 );
  return arr.join( "\n" );
}
