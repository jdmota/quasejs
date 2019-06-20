import SourceMapExtractorBase, { Original, SourceMapInfoWithMap } from "./extractor-base";
import { GetFile } from "./readfile-fetch";
import { makeAbsolute, resolveAsUrl, isUrl } from "@quase/path-url";

export default class SourceMapExtractor extends SourceMapExtractorBase {

  private fileGetter: GetFile;
  private mapRequest: Map<string, Promise<SourceMapInfoWithMap | null>>;

  constructor() {
    super();
    this.fileGetter = new GetFile();
    this.mapRequest = new Map();
  }

  private read( file: string ): Promise<string> {
    return isUrl( file ) ? this.fileGetter.fetch( file ) : this.fileGetter.readFile( file );
  }

  private async _getMap( file: string ): Promise<SourceMapInfoWithMap | null> {

    const headers = isUrl( file ) ? ( await this.fileGetter.fetchResponse( file ) ).headers : null;
    const url = headers ? headers.get( "SourceMap" ) || headers.get( "X-SourceMap" ) : null;
    let mapData;

    if ( url ) {
      mapData = this.getMapFromUrl( file, url );
    } else {
      mapData = this.getMapFromFile( file, await this.read( file ) );
    }

    if ( !mapData ) {
      return null;
    }

    const mapLocation = mapData.mapLocation;
    const map = mapData.map == null ?
      JSON.parse( await this.read( mapData.mapLocation ) ) :
      mapData.map;

    return {
      map,
      mapLocation
    };
  }

  getMap( file: string ): Promise<SourceMapInfoWithMap | null> {
    file = makeAbsolute( file );

    let job = this.mapRequest.get( file );
    if ( !job ) {
      job = this._getMap( file );
      this.mapRequest.set( file, job );
    }
    return job;
  }

  purge( file: string ) {
    file = makeAbsolute( file );
    this.fileGetter.delete( file );
    this.mapRequest.delete( file );
  }

  async getOriginalLocation( file: string, generated: { line: number; column: number; bias?: number } ): Promise<Original | { code: string }> {

    const info = await this.getMap( file );

    if ( info && info.map ) {
      const { map, mapLocation } = info;
      const original = await this.getOriginalLocationFromMap( map, mapLocation, generated );

      if ( original ) {
        if ( original.originalCode == null && original.originalFile ) {
          original.originalCode = await this.read( original.originalFile );
        }
        return original;
      }
    }

    return {
      code: await this.read( file )
    };
  }

  async getOriginalSources( file: string ): Promise<string[]> {

    const info = await this.getMap( file );

    if ( info && info.map ) {
      const { map, mapLocation } = info;
      return map.sources.map( ( s: string ) => resolveAsUrl( mapLocation, s ) );
    }

    return [];
  }

}
