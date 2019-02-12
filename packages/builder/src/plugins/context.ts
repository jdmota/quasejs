import { resolvePath, makeAbsolute } from "../utils/path";
import isFile from "../utils/is-file";
import { ModuleInfo } from "../module";
import { WatchedFiles } from "../types";

const fs = require( "fs-extra" );
const { joinSourceMaps } = require( "@quase/source-map" );
const ONLY_EXISTANCE = { onlyExistance: true };

export class BuilderContext {

  builderOptions: any;
  files: WatchedFiles;

  constructor( builderOptions: any, files?: WatchedFiles ) {
    const {
      mode, context, entries, dest, cwd,
      publicPath, runtime, hmr, optimization
    } = builderOptions;
    this.builderOptions = {
      mode,
      context,
      entries,
      dest,
      cwd,
      publicPath,
      runtime,
      hmr,
      optimization
    };
    this.files = files || new Map();
  }

  joinSourceMaps( maps: any[] ) {
    return joinSourceMaps( maps );
  }

  isDest( id: string ): boolean {
    return id.indexOf( this.builderOptions.dest ) === 0;
  }

  createFakePath( key: string ): string {
    return resolvePath( `_quase_builder_/${key}`, this.builderOptions.context );
  }

  isFakePath( path: string ): boolean {
    return path.startsWith( resolvePath( "_quase_builder_", this.builderOptions.context ) );
  }

  wrapInJsPropKey( string: string ): string {
    return /^[$_a-zA-Z][$_a-zA-Z0-9]*$/.test( string ) ? string : JSON.stringify( string );
  }

  wrapInJsString( string: string ): string {
    return /("|'|\\)/.test( string ) ? JSON.stringify( string ) : `'${string}'`;
  }

  registerFile( _file: string, { onlyExistance }: { onlyExistance?: boolean } = {} ) {
    const time = Date.now();
    const file = makeAbsolute( _file );
    const curr = this.files.get( file );
    if ( curr == null ) {
      this.files.set( file, {
        time,
        onlyExistance
      } );
    } else if ( !onlyExistance && curr ) {
      curr.onlyExistance = false;
    }
  }

  stat( file: string ) {
    this.registerFile( file );
    return fs.stat( file );
  }

  readFile( file: string, enconding?: string ) {
    this.registerFile( file );
    return fs.readFile( file, enconding );
  }

  readdir( folder: string ) {
    this.registerFile( folder );
    return fs.readdir( folder );
  }

  async isFile( file: string ) {
    this.registerFile( file, ONLY_EXISTANCE );
    return isFile( fs, file );
  }

  dataToString( data: string | Buffer | Uint8Array ) {
    if ( data instanceof Uint8Array ) {
      return Buffer.from( data ).toString();
    }
    return data.toString();
  }

}

export class ModuleContext extends BuilderContext {

  id: string;
  path: string;
  relativePath: string;
  relativeDest: string;
  normalized: string;
  type: string;
  innerId: string|null;

  constructor( builderOptions: any, m: ModuleInfo, files?: WatchedFiles ) {
    super( builderOptions, files );
    this.id = m.id;
    this.type = m.type;
    this.innerId = m.innerId;
    this.path = m.path;
    this.relativePath = m.relativePath;
    this.relativeDest = m.relativeDest;
    this.normalized = m.normalized;
  }

}

export class ModuleContextWithoutFS extends ModuleContext {

  registerFile( _: string, _2: { onlyExistance?: boolean } = {} ) {
    throw new Error( "File System operations are not possible with this context" );
  }

}