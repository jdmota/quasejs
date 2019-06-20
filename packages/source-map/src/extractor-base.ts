import encoding from "./encoding";
import { RawSourceMap, RawIndexMap, SourceMapConsumer } from "source-map";

const { resolveAsUrl } = require( "@quase/path-url" );

const baseRegex = "\\s*[@#]\\s*sourceMappingURL\\s*=\\s*([^\\s]*)",
  // Matches /* ... */ comments
  regex1 = new RegExp( "/\\*" + baseRegex + "\\s*\\*/" ),
  // Matches // .... comments
  regex2 = new RegExp( "//" + baseRegex + "($|\n|\r\n?)" ),
  // Matches DataUrls
  regexDataUrl = /data:[^;\n]+;base64,(.*)/;

export type SourceMapType = string | RawSourceMap | RawIndexMap;

export type SourceMapInfo = {
  map: RawSourceMap | null;
  mapLocation: string;
};

export type SourceMapInfoWithMap = {
  map: RawSourceMap;
  mapLocation: string;
};

export type Original = {
  source: string | null;
  line: number | null;
  column: number | null;
  name: string | null;
  originalFile: string | null;
  originalCode: string | null;
};

export default class SourceMapExtractorBase {

  getMapFromUrl( fileLocation: string, url: string ): SourceMapInfo {

    const dataUrlMatch = url.match( regexDataUrl );

    if ( dataUrlMatch ) {
      return {
        map: JSON.parse( encoding.decode( dataUrlMatch[ 1 ] ) ),
        mapLocation: fileLocation
      };
    }

    return {
      map: null,
      mapLocation: resolveAsUrl( fileLocation, url )
    };
  }

  getMapFromFile( fileLocation: string, fileContent: string ): SourceMapInfo | null {

    const match = fileContent.match( regex1 ) || fileContent.match( regex2 );

    if ( !match ) {
      return null;
    }

    return this.getMapFromUrl( fileLocation, match[ 1 ] );
  }

  async getOriginalLocationFromMap( map: RawSourceMap | SourceMapConsumer, mapLocation: string, generated: { line: number; column: number; bias?: number } ): Promise<Original | null> {

    const consumer = map instanceof SourceMapConsumer ? map : await new SourceMapConsumer( map );

    const pos: {
      source: string | null;
      line: number | null;
      column: number | null;
      name: string | null;
    } = consumer.originalPositionFor( generated );

    let result;

    if ( pos.line != null ) {
      const originalFile = resolveAsUrl( mapLocation, pos.source );
      const originalCode = pos.source ? consumer.sourceContentFor( pos.source, true ) : null;

      result = {
        ...pos,
        originalFile,
        originalCode
      };
    } else {
      result = null;
    }

    if ( !( map instanceof SourceMapConsumer ) ) {
      consumer.destroy();
    }

    return result;
  }

}
