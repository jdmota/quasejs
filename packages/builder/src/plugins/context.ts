import { Options, WatchedFiles } from "../types";
import { ModuleInfo } from "../module/module";
import { resolvePath, makeAbsolute } from "../utils/path";

const fs = require( "fs-extra" );
const { joinSourceMaps } = require( "@quase/source-map" );

const ONLY_EXISTANCE = { onlyExistance: true };

export class BuilderUtil {

  builderOptions: any;
  files: WatchedFiles;
  warnings: string[];

  constructor( builderOptions: Options, files?: WatchedFiles ) {
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
    this.warnings = [];
  }

  warn( text: string ) {
    this.warnings.push( text );
  }

  joinSourceMaps( maps: any[] ) {
    maps = maps.filter( Boolean );
    if ( maps.length === 0 ) {
      return null;
    }
    if ( maps.length === 1 ) {
      return {
        ...maps[ 0 ]
      };
    }
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

  readFile( file: string, enconding?: string ): string | Buffer {
    this.registerFile( file );
    return fs.readFile( file, enconding );
  }

  readdir( folder: string ): Promise<string[]> {
    this.registerFile( folder );
    return fs.readdir( folder );
  }

  async isFile( file: string ): Promise<boolean> {
    this.registerFile( file, ONLY_EXISTANCE );
    try {
      const s = await fs.stat( file );
      return s.isFile() || s.isFIFO();
    } catch ( err ) {
      if ( err.code === "ENOENT" || err.code === "ENOTDIR" ) {
        return false;
      }
      throw err;
    }
  }

  dataToString( data: string | Buffer | Uint8Array ) {
    if ( data instanceof Uint8Array ) {
      return Buffer.from( data ).toString();
    }
    return data.toString();
  }

}

export class ModuleContext extends BuilderUtil {

  id: string;
  path: string;
  relativePath: string;
  transforms: ReadonlyArray<string>;

  constructor( builderOptions: Options, m: ModuleInfo, files?: WatchedFiles ) {
    super( builderOptions, files );
    this.id = m.id;
    this.path = m.path;
    this.relativePath = m.relativePath;
    this.transforms = m.transforms;
  }

}
