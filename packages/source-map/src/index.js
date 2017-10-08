import FileSystem from "../../fs/src/file-system";
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

    for ( let i = 1; i < maps.length; i++ ) {

      pos = new SourceMapConsumer( maps[ i ] ).generatedPositionFor( {
        source: inputMapConsumer.file,
        line: pos.line,
        column: pos.column
      } );

      if ( pos.column == null ) {
        return;
      }

    }

    const newMapping = {
      source: null,
      original: null,
      name: m.name,
      generated: pos
    };

    if ( m.source && typeof m.originalLine === "number" && typeof m.originalColumn === "number" ) {
      newMapping.source = m.source;
      newMapping.original = { line: m.originalLine, column: m.originalColumn };
    }

    mergedGenerator.addMapping( newMapping );

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

  constructor( fs = new FileSystem() ) {
    this.fs = fs;
    this.cacheMapLocation = Object.create( null );
    this.mapRequest = Object.create( null );
  }

  static consumeSourceMap( data ) {
    return data == null ? null : new SourceMapConsumer( JSON.parse( data ) );
  }

  async _getMap( file ) {

    const code = await this.fs.getFile( file );

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

      const mapLocation = this.cacheMapLocation[ file ] = resolveAsUrl( file, url );

      let sourcemap;

      try {
        sourcemap = await this.fs.getFile( mapLocation );
      } catch ( e ) {
        // The sourcemap that was supposed to exist, was not found
      }

      return {
        map: SourceMapExtractor.consumeSourceMap( sourcemap ),
        mapLocation
      };
    }

  }

  getMap( file ) {
    file = makeAbsolute( file );
    return this.mapRequest[ file ] || ( this.mapRequest[ file ] = this._getMap( file ) );
  }

  purge( file ) {
    if ( file ) {
      file = makeAbsolute( file );
      this.fs.purge( file );
      this.mapRequest[ file ] = null;
      this.cache[ this.cacheMapLocation[ file ] ] = null;
      this.cacheMapLocation[ file ] = null;
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
        const originalCode = map.sourceContentFor( pos.source, true ) || await this.fs.getFile( originalFile );

        pos.originalFile = originalFile;
        pos.originalCode = originalCode;

        return pos;
      }
    }

    return { code: await this.fs.getFile( file ) };
  }

}
