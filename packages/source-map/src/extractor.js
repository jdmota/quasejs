// @flow
import SourceMapExtractorBase, { type SourceMapInfoWithMap, type Original } from "./extractor-base";

const { makeAbsolute, resolveAsUrl, isUrl } = require( "@quase/path-url" );

export default class SourceMapExtractor extends SourceMapExtractorBase {

  +fs: Object;
  +requester: Object;
  +mapRequest: Map<string, Promise<?SourceMapInfoWithMap>>;

  constructor( fs: Object, requester: Object ) {
    super();
    this.fs = fs;
    this.requester = requester;
    this.mapRequest = new Map();
  }

  async _read( file: string ): Promise<string> {
    return isUrl( file ) ? ( await this.requester.fetch( file ) ).text() : this.fs.readFile( file, "utf8" );
  }

  async _getMap( file: string ): Promise<?SourceMapInfoWithMap> {

    const headers = isUrl( file ) ? ( await this.requester.fetch( file ) ).headers : {};
    const url = headers.SourceMap || headers[ "X-SourceMap" ];
    let mapData;

    if ( url ) {
      mapData = this.getMapFromUrl( file, url );
    } else {
      mapData = this.getMapFromFile( file, await this._read( file ) );
    }

    if ( !mapData ) {
      return;
    }

    const mapLocation = mapData.mapLocation;
    const map = mapData.map == null ?
      SourceMapExtractorBase.consumeSourceMap( await this._read( mapData.mapLocation ) ) :
      mapData.map;

    return {
      map,
      mapLocation
    };
  }

  getMap( file: string ): Promise<?SourceMapInfoWithMap> {
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
    if ( isUrl( file ) ) {
      this.requester.purge( file );
    } else {
      this.fs.purge( file );
    }
    this.mapRequest.delete( file );
  }

  // file, generated: { line, column, bias? }
  async getOriginalLocation( file: string, generated: Object ): Promise<Original | { code: string }> {

    const { map, mapLocation } = await this.getMap( file ) || {};

    if ( map ) {
      const original = this.getOriginalLocationFromMap( map, mapLocation, generated );

      if ( original ) {
        if ( original.originalCode == null ) {
          original.originalCode = await this._read( original.originalFile );
        }
        return original;
      }
    }

    return {
      code: await this._read( file )
    };
  }

  async getOriginalSources( file: string ): Promise<string[]> {

    const { map, mapLocation } = await this.getMap( file ) || {};

    if ( map ) {
      return map.sources.map( s => resolveAsUrl( mapLocation, s ) );
    }

    return [];
  }

}
