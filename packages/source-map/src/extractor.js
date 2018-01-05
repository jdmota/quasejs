import encoding from "./encoding";

const { SourceMapConsumer } = require( "source-map" );
const { makeAbsolute, resolveAsUrl, isUrl } = require( "@quase/path-url" );

const baseRegex = "\\s*[@#]\\s*sourceMappingURL\\s*=\\s*([^\\s]*)",
    // Matches /* ... */ comments
    regex1 = new RegExp( "/\\*" + baseRegex + "\\s*\\*/" ),
    // Matches // .... comments
    regex2 = new RegExp( "//" + baseRegex + "($|\n|\r\n?)" ),
    // Matches DataUrls
    regexDataUrl = /data:[^;\n]+;base64,(.*)/;

export default class SourceMapExtractor {

  constructor( fs, requester ) {
    this.fs = fs;
    this.requester = requester;
    this.cacheMapLocation = Object.create( null );
    this.mapRequest = Object.create( null );
  }

  static consumeSourceMap( data ) {
    return data == null ? null : new SourceMapConsumer( JSON.parse( data ) );
  }

  async _read( file ) {
    return isUrl( file ) ? ( await this.requester.fetch( file ) ).text() : this.fs.readFile( file, "utf8" );
  }

  async _getMap( file ) {

    const headers = isUrl( file ) ? ( await this.requester.fetch( file ) ).headers : {};

    let url = headers.SourceMap || headers[ "X-SourceMap" ];

    if ( !url ) {
      const code = await this._read( file );
      const match = code.match( regex1 ) || code.match( regex2 );

      if ( !match ) {
        return;
      }

      url = match[ 1 ];
    }

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
      sourcemap = await this._read( mapLocation );
    } catch ( e ) {
      // The sourcemap that was supposed to exist, was not found
    }

    return {
      map: SourceMapExtractor.consumeSourceMap( sourcemap ),
      mapLocation
    };

  }

  getMap( file ) {
    file = makeAbsolute( file );
    return this.mapRequest[ file ] || ( this.mapRequest[ file ] = this._getMap( file ) );
  }

  purge( file ) {
    file = makeAbsolute( file );
    if ( isUrl( file ) ) {
      this.requester.purge( file );
    } else {
      this.fs.purge( file );
    }
    this.mapRequest[ file ] = null;
    this.cacheMapLocation[ file ] = null;
  }

  // file, generated: { line, column, bias? }
  async getOriginalLocation( file, generated ) {

    const { map, mapLocation } = await this.getMap( file ) || {};

    if ( map ) {
      const pos = map.originalPositionFor( generated ); // { source, line, column, name }

      if ( pos.line != null ) {
        const originalFile = resolveAsUrl( mapLocation, pos.source );
        const originalCode = map.sourceContentFor( pos.source, true ) || await this._read( originalFile );

        pos.originalFile = originalFile;
        pos.originalCode = originalCode;

        return pos;
      }
    }

    return { code: await this._read( file ) };
  }

}
