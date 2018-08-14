// @flow
import encoding from "./encoding";

const { SourceMapConsumer } = require( "source-map" );
const { resolveAsUrl } = require( "@quase/path-url" );

const baseRegex = "\\s*[@#]\\s*sourceMappingURL\\s*=\\s*([^\\s]*)",
    // Matches /* ... */ comments
    regex1 = new RegExp( "/\\*" + baseRegex + "\\s*\\*/" ),
    // Matches // .... comments
    regex2 = new RegExp( "//" + baseRegex + "($|\n|\r\n?)" ),
    // Matches DataUrls
    regexDataUrl = /data:[^;\n]+;base64,(.*)/;

export type SourceMapInfo = {
  map: ?Object,
  mapLocation: string
};

export type SourceMapInfoWithMap = {
  map: Object,
  mapLocation: string
};

export type Original = {
  originalFile: string,
  originalCode: ?string
};

export default class SourceMapExtractorBase {

  static consumeSourceMap( data: string ): Object {
    return new SourceMapConsumer( JSON.parse( data ) );
  }

  getMapFromUrl( fileLocation: string, url: string ): SourceMapInfo {

    const dataUrlMatch = url.match( regexDataUrl );

    if ( dataUrlMatch ) {
      return {
        map: SourceMapExtractorBase.consumeSourceMap( encoding.decode( dataUrlMatch[ 1 ] ) ),
        mapLocation: fileLocation
      };
    }

    return {
      map: null,
      mapLocation: resolveAsUrl( fileLocation, url )
    };
  }

  getMapFromFile( fileLocation: string, fileContent: string ): ?SourceMapInfo {

    const match = fileContent.match( regex1 ) || fileContent.match( regex2 );

    if ( !match ) {
      return;
    }

    return this.getMapFromUrl( fileLocation, match[ 1 ] );
  }

  // generated: { line, column, bias? }
  getOriginalLocationFromMap( map: Object, mapLocation: string, generated: Object ): ?Original {

    const pos = map.originalPositionFor( generated ); // { source, line, column, name }

    if ( pos.line != null ) {
      const originalFile = resolveAsUrl( mapLocation, pos.source );
      const originalCode = map.sourceContentFor( pos.source, true );

      pos.originalFile = originalFile;
      pos.originalCode = originalCode;
      return pos;
    }

    return null;
  }

}
