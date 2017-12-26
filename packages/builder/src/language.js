// @flow
import Builder from "./builder";
import type {
  Data, DataType, ToWrite,
  ImportedName, ExportedName, NotResolvedDep,
  FinalAsset, FinalAssets
} from "./types";

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
  importedNames( Builder ): Promise<ImportedName[]>,
  exportedNames( Builder ): Promise<ExportedName[]>,
  dependencies( Builder ): Promise<NotResolvedDep[]>,
  render( Builder, FinalAsset, FinalAssets, Set<string> ): Promise<ToWrite>
}

export default class Language implements ILanguage {

  static TYPE = "";

  +id: string;
  +data: Data;
  +dataType: DataType;
  +options: Object;
  cachedMoreLanguages: ?Promise<{ type: string, data: Data }[]>;
  cachedImportedNames: ?Promise<ImportedName[]>;
  cachedExportedNames: ?Promise<ExportedName[]>;
  cachedDependencies: ?Promise<NotResolvedDep[]>;

  constructor( id: string, data: Data, options: Object ) {
    this.id = id;
    this.data = data;
    this.dataType = getDataType( data );
    this.options = Object.assign( {}, options );
    this.cachedMoreLanguages = null;
    this.cachedImportedNames = null;
    this.cachedExportedNames = null;
    this.cachedDependencies = null;
  }

  moreLanguagesImpl() {
    return this.cachedMoreLanguages || (
      this.cachedMoreLanguages = this.moreLanguages()
    );
  }

  exportedNamesImpl() {
    return this.cachedExportedNames || (
      this.cachedExportedNames = this.exportedNames()
    );
  }

  importedNamesImpl() {
    return this.cachedImportedNames || (
      this.cachedImportedNames = this.importedNames()
    );
  }

  dependenciesImpl() {
    return this.cachedDependencies || (
      this.cachedDependencies = this.dependencies()
    );
  }

  async resolve( imported: string, importer: string, builder: Builder ) {
    const resolved = path.resolve( path.dirname( importer ), imported );
    const isFile = await builder.fileSystem.isFile( resolved );
    return isFile && resolved;
  }

  async moreLanguages() {
    return [];
  }

  async importedNames() {
    return [];
  }

  async exportedNames() {
    return [];
  }

  async dependencies() {
    return [];
  }

  async render( builder: Builder, asset: FinalAsset, finalAssets: FinalAssets, otherUsedHelpers: Set<string> ) { // eslint-disable-line
    return {
      data: this.data
    };
  }

}