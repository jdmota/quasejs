// @flow
import Builder from "./builder";
import type Module from "./module";
import type { LoaderOutput, ToWrite, DepsInfo, FinalAsset, FinalAssets } from "./types";

const path = require( "path" );

export interface ILanguage {
  resolve( string, string, Builder ): Promise<?string | false>,
  dependencies( Builder ): Promise<DepsInfo>,
  renderAsset( Builder, FinalAsset, FinalAssets ): Promise<ToWrite>
}

export default class Language implements ILanguage {

  +id: string;
  +output: LoaderOutput;
  +options: Object;

  constructor( options: Object, module: Module, builder: Builder ) { // eslint-disable-line no-unused-vars
    this.id = module.id;
    this.output = module.lastOutput;
    this.options = Object.assign( {}, options );
  }

  async resolve( imported: string, importer: string, builder: Builder ) {
    const resolved = path.resolve( path.dirname( importer ), imported );
    const isFile = await builder.fileSystem.isFile( resolved, importer );
    return isFile && resolved;
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
      data: this.output.data
    };
  }

}
