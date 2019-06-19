const { relative } = require( "path" );
const { SourceMapGenerator, SourceMapConsumer, } = require( "@quase/source-map" );

function countNewLines( string: string ) {
  let c = 0;
  for ( let i = 0; i < string.length; i++ ) {
    const code = string.charCodeAt( i );
    if ( code === 10 ) {
      c++;
    } else if ( code === 13 ) {
      c++;
      if ( string.charCodeAt( i + 1 ) === 10 ) {
        i++;
      }
    }
  }
  return c;
}

export default class StringBuilder {

  private finalString: string;
  private line: number;
  private column: number;
  private cwd: string;
  private sourceMapGenerator: any;

  constructor( { sourceMap, cwd, file }: { sourceMap: any; cwd: string; file: string } ) {
    this.finalString = "";
    this.line = 0;
    this.column = 0;
    this.cwd = cwd;
    this.sourceMapGenerator = !!sourceMap && new SourceMapGenerator( { file } );
  }

  append( string: string, map?: any ) { // map: { file, sources, sourceRoot, sourcesContent }

    if ( this.sourceMapGenerator && map ) {
      const consumer = new SourceMapConsumer( map );
      consumer.eachMapping( ( m: any ) => {

        const newMapping: any = {
          source: null,
          original: null,
          name: m.name,
          generated: m.generatedLine === 1 ?
            { line: this.line + m.generatedLine, column: this.column + m.generatedColumn } :
            { line: this.line + m.generatedLine, column: m.generatedColumn }
        };

        if ( m.source && typeof m.originalLine === "number" && typeof m.originalColumn === "number" ) {
          newMapping.source = m.source;
          newMapping.original = { line: m.originalLine, column: m.originalColumn };
        }

        this.sourceMapGenerator.addMapping( newMapping );
        if ( m.source ) {
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
    map.sources = map.sources.map( ( source: string ) => relative( this.cwd, source ).replace( /\\/g, "/" ) );
    return map;
  }

}
