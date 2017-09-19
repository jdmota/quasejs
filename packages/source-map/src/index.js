import _getFile from "../../fs/src/get-file";
import { makeAbsolute, resolveAsUrl } from "../../pathname/src/path-url";
import encoding from "./encoding";

const { SourceMapConsumer, SourceMapGenerator } = require( "source-map" );

export function joinSourceMaps( maps ) {

  maps = maps.filter( Boolean );

  if ( maps.length === 0 ) {
    return null;
  }

  if ( maps.length === 1 ) {
    return Object.assign( {}, maps[ 0 ] );
  }

  const inputMapConsumer = new SourceMapConsumer( maps[ 0 ] );
  const outputMapConsumers = maps.map( ( map, i ) => i && new SourceMapConsumer( map ) );

  const mergedGenerator = new SourceMapGenerator( {
    file: inputMapConsumer.file,
    sources: inputMapConsumer.sources,
    sourceRoot: inputMapConsumer.sourceRoot,
    sourcesContent: inputMapConsumer.sourcesContent
  } );

  inputMapConsumer.eachMapping( m => {

    let pos = {
      line: m.generatedLine,
      column: m.generatedColumn
    };

    for ( let i = 1; i < outputMapConsumers.length; i++ ) {

      pos = outputMapConsumers[ i ].generatedPositionFor( {
        source: inputMapConsumer.file,
        line: pos.line,
        column: pos.column
      } );

      if ( pos.column == null ) {
        return;
      }

    }

    mergedGenerator.addMapping( {
      source: m.source,
      name: m.name,
      original: m.source == null ? null : { line: m.originalLine, column: m.originalColumn },
      generated: pos
    } );

  } );

  const map = Object.assign( {}, maps[ 0 ] );
  map.mappings = mergedGenerator.toJSON().mappings;
  return map;

}

const baseRegex = "\\s*[@#]\\s*sourceMappingURL\\s*=\\s*([^\\s]*)",
    // Matches /* ... */ comments
    regex1 = new RegExp( "/\\*" + baseRegex + "\\s*\\*/" ),
    // Matches // .... comments
    regex2 = new RegExp( "//" + baseRegex + "($|\n|\r\n?)" ),
    // Matches DataUrls
    regexDataUrl = /data:[^;\n]+;base64,(.*)/;

export function sourceMapToUrl( map ) {
  if ( !encoding.encode ) {
    throw new Error( "Unsupported environment: `window.btoa` or `Buffer` should be supported." );
  }
  return "data:application/json;charset=utf-8;base64," + encoding.encode( map.toString() );
}

export function sourceMapToString( map ) {
  return JSON.stringify( map );
}

export function getOriginalLocation( map, generated ) { // map, generated: { line, column, bias? }
  return new SourceMapConsumer( map ).originalPositionFor( generated ); // { source, line, column, name }
}

export class SourceMapExtractor {

  constructor() {
    this.cache = Object.create( null );
    this.cacheMaps = Object.create( null );
    this.cacheMapsLocation = Object.create( null );
    this.mapRequest = Object.create( null );
  }

  static consumeSourceMap( data ) {
    return data == null ? null : new SourceMapConsumer( JSON.parse( data ) );
  }

  getFile( file ) {
    return this.cache[ file ] || ( this.cache[ file ] = _getFile( file ) );
  }

  async _getMap( file ) {

    const code = await this.getFile( file );

    const match = code.match( regex1 ) || code.match( regex2 );

    if ( match ) {
      const url = match[ 1 ];
      const dataUrlMatch = url.match( regexDataUrl );

      if ( dataUrlMatch ) {
        return {
          map: SourceMapExtractor.consumeSourceMap( encoding.decode( dataUrlMatch[ 1 ] ) ),
          mapLocation: file
        };
      }

      const mapLocation = this.cacheMapsLocation[ file ] = resolveAsUrl( file, url );

      let sourcemap;

      try {
        sourcemap = await this.getFile( mapLocation );
      } catch ( e ) {
        // File was found, but the sourcemap that was supposed to exist, was not found
      }

      return {
        map: SourceMapExtractor.consumeSourceMap( sourcemap ),
        mapLocation
      };
    }

  }

  getMap( file ) {
    return this.mapRequest[ file ] || ( this.mapRequest[ file ] = this._getMap( file ) );
  }

  purge( file ) {
    if ( file && this.cache[ file ] ) {
      this.cache[ file ] = null;
      this.mapRequest[ file ] = null;
      this.cache[ this.cacheMapsLocation[ file ] ] = null;
      this.cacheMapsLocation[ file ] = null;
    }
  }

  // file, generated: { line, column, bias? }
  async getOriginalLocation( file, generated ) {

    file = makeAbsolute( file );

    const { map, mapLocation } = await this.getMap( file ) || {};

    if ( map ) {
      const pos = map.originalPositionFor( generated ); // { source, line, column, name }

      if ( pos.line != null ) {
        const originalFile = resolveAsUrl( mapLocation, pos.source );
        const originalCode = map.sourceContentFor( pos.source, true ) || await this.getFile( originalFile );

        pos.originalFile = originalFile;
        pos.originalCode = originalCode;

        return pos;
      }
    }

    return { code: await this.getFile( file ) };
  }

}
