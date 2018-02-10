// @flow
import Builder from "./builder";
import type Module from "./module";
import type { Data, DataType, ToWrite, DepsInfo, FinalAsset, FinalAssets } from "./types";

const path = require( "path" );

function getDataType( data ) {
  if ( data instanceof Buffer ) {
    return "buffer";
  }
  if ( typeof data === "string" ) {
    return "string";
  }
  throw new Error( "Unsupported data type" );
}

export interface ILanguage {
  resolve( string, string, Builder ): Promise<?string | boolean>,
  moreLanguages( Builder ): Promise<{ type: string, data: Data }[]>,
  dependencies( Builder ): Promise<DepsInfo>,
  renderAsset( Builder, FinalAsset, FinalAssets ): Promise<ToWrite>
}

export default class Language implements ILanguage {

  static TYPE = "";

  +id: string;
  +data: Data;
  +dataType: DataType;
  +options: Object;

  constructor( options: Object, module: Module, builder: Builder ) { // eslint-disable-line no-unused-vars
    this.id = module.id;
    this.data = module.data;
    this.dataType = getDataType( module.data );
    this.options = Object.assign( {}, options );
  }

  async resolve( imported: string, importer: string, builder: Builder ) {
    const resolved = path.resolve( path.dirname( importer ), imported );
    const isFile = await builder.fileSystem.isFile( resolved, importer );
    return isFile && resolved;
  }

  async moreLanguages() {
    return [];
  }

  async dependencies() {
    return {
      dependencies: [],
      importedNames: [],
      exportedNames: []
    };
  }

  async renderAsset( builder: Builder, asset: FinalAsset, finalAssets: FinalAssets ) { // eslint-disable-line
    if ( asset.srcs.length !== 1 ) {
      throw new Error( `Asset "${asset.normalized}" has more than 1 source. Probably there is some language plugin missing.` );
    }
    return {
      data: this.data
    };
  }

}
