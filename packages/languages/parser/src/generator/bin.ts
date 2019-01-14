import Grammar from "./grammar";

const fs = require( "fs" );
const path = require( "path" );
const makeDir = require( "make-dir" );

/* eslint no-console: 0 */
export default function( args: string[] ) {
  if ( args.length !== 2 ) {
    console.error( "Usage: quase-parser-generator <grammar file> <output>" );
    return;
  }

  const grammarFile = path.resolve( args[ 0 ] );
  const outputFile = path.resolve( args[ 1 ] );

  const grammarText = fs.readFileSync( grammarFile, "utf8" );

  const grammar = new Grammar( grammarText );

  const generation = grammar.generate();
  const conflicts = grammar.reportConflicts();

  for ( const conflict of conflicts ) {
    console.log( conflict );
  }

  makeDir.sync( path.dirname( outputFile ) );
  fs.writeFileSync( outputFile, generation );
  console.log( "Done!" );
}
