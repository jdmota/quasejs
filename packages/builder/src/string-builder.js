import { sourceMapToString, sourceMapToUrl } from "../../source-map/src";

const { relative } = require( "path" );
const { SourceMapGenerator, SourceMapConsumer } = require( "source-map" );

function countNewLines( string ) {
  let c = 0;
  for ( let i = 0; i < string.length; i++ ) {
    if ( string.charCodeAt( i ) === 10 ) c++;
  }
  return c;
}

export default class StringBuilder {

  constructor( { sourceMap, cwd, file } ) {
    this.finalString = "";
    this.line = 0;
    this.column = 0;
    this.cwd = cwd;
    this.sourceMapGenerator = !!sourceMap && new SourceMapGenerator( { file } );
  }

  append( string, map ) { // map: { file, sources, sourceRoot, sourcesContent }

    if ( this.sourceMapGenerator && map ) {
      const consumer = new SourceMapConsumer( map );
      consumer.eachMapping( m => {
        this.sourceMapGenerator.addMapping( {
          source: m.source,
          name: m.name,
          original: m.source == null ? null : { line: m.originalLine, column: m.originalColumn },
          generated: m.generatedLine === 1 ?
            { line: this.line + m.generatedLine, column: this.column + m.generatedColumn } :
            { line: this.line + m.generatedLine, column: m.generatedColumn }
        } );
        if ( m.source != null ) {
          this.sourceMapGenerator.setSourceContent( m.source, consumer.sourceContentFor( m.source ) );
        }
      } );
    }

    this.finalString += string;

    if ( this.sourceMapGenerator ) {
      const lineOffset = countNewLines( string );

      if ( lineOffset === 0 ) {
        this.column += string.length;
      } else {
        this.column = string.length - string.lastIndexOf( "\n" ) - 1;
      }

      this.line += lineOffset;
    }

  }

  toString() {
    return this.finalString;
  }

  sourceMap() {
    if ( !this.sourceMapGenerator ) {
      return null;
    }
    const map = this.sourceMapGenerator.toJSON();
    map.sources = map.sources.map( source => relative( this.cwd, source ).replace( /\\/g, "/" ) );
    map.toString = function() {
      return sourceMapToString( this );
    };
    map.toUrl = function() {
      return sourceMapToUrl( this );
    };
    return map;
  }

}
