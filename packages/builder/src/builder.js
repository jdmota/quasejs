// @flow
import hash from "./utils/hash";
import createRuntime, { type RuntimeArg } from "./runtime/create-runtime";
import processGraph from "./graph";
import type {
  FinalAsset, FinalAssets,
  PerformanceOpts, MinimalFS, ToWrite,
  Info, Options, Plugin
} from "./types";
import { resolvePath, relative, lowerPath } from "./id";
import Language from "./language";
import FileSystem from "./filesystem";
import Module, { type ModuleArg } from "./module";
import validateOptions from "./options";

const fs = require( "fs-extra" );
const path = require( "path" );

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /(\..*)?$/;

export default class Builder {

  +options: Object;
  +entries: string[];
  +context: string;
  +dest: string;
  +cwd: string;
  +sourceMaps: boolean | "inline";
  +hashing: boolean;
  +publicPath: string;
  +warn: Function;
  +fileSystem: FileSystem;
  +fs: MinimalFS;
  +cli: Object;
  +reporter: { plugin: Function, options: Object };
  +watch: boolean;
  +watchOptions: ?Object;
  +languages: { [key: string]: [ Class<Language>, Object ] };
  +plugins: { name: ?string, plugin: Plugin }[];
  +performance: PerformanceOpts;
  +serviceWorker: Object;
  +cleanBeforeBuild: boolean;
  +modules: Map<string, Module>;
  +modulesPerFile: Map<string, Module[]>;
  +moduleEntries: Set<Module>;
  +usedIds: Set<string>;
  +promises: Promise<void>[];

  constructor( _opts: Options ) {

    const options = this.options = validateOptions( _opts );

    this.cwd = options.cwd;
    this.context = options.context;
    this.dest = options.dest;
    this.publicPath = options.publicPath;
    this.fs = options.fs;
    this.sourceMaps = options.sourceMaps;
    this.hashing = options.hashing;
    this.warn = options.warn;
    this.cli = options.cli;
    this.watch = options.watch;
    this.watchOptions = options.watchOptions;
    this.reporter = options.reporter;
    this.cleanBeforeBuild = options.cleanBeforeBuild;
    this.performance = options.performance;

    this.fileSystem = new FileSystem();

    this.plugins = options.plugins.map(
      ( { name, plugin, options } ) => {
        const p = plugin( options );
        return {
          name: p.name || name,
          plugin: p
        };
      }
    );

    this.entries = options.entries.map( e => resolvePath( e, this.context ) );

    this.languages = {};

    options.languages.forEach( ( { plugin, options } ) => {
      this.languages[ plugin.TYPE ] = [ plugin, options ];
    } );

    this.serviceWorker = options.serviceWorker;

    this.serviceWorker.staticFileGlobs = this.serviceWorker.staticFileGlobs.map( p => path.join( this.dest, p ) );
    this.serviceWorker.stripPrefixMulti[ `${this.dest}${path.sep}`.replace( /\\/g, "/" ) ] = this.publicPath;
    this.serviceWorker.filename = this.serviceWorker.filename ? resolvePath( this.serviceWorker.filename, this.dest ) : "";

    this.modules = new Map();
    this.modulesPerFile = new Map();
    this.moduleEntries = new Set();
    this.usedIds = new Set();

    this.promises = [];

  }

  createFakePath( key: string ): string {
    return resolvePath( `_quase_builder_/${key}`, this.context );
  }

  isSplitPoint( required: Module, module: Module ): Promise<boolean> {
    return this.applyPluginPhaseFirst( "isSplitPoint", null, required, module );
  }

  async applyPluginPhaseFirst<T>( phase: $Keys<Plugin>, postProcess: ?( any, ?string ) => T, ...args: mixed[] ): Promise<T> {
    for ( const { name, plugin } of this.plugins ) {
      const fn = plugin[ phase ];
      if ( fn ) {
        // $FlowFixMe
        const result = await fn( ...args, this );
        if ( result != null ) {
          return postProcess ? postProcess( result, name ) : result;
        }
      }
    }
    throw new Error( `No hook ${phase} returned a valid output.` );
  }

  async applyPluginPhasePipe<T>( phase: $Keys<Plugin>, postProcess: ?( any, any, ?string ) => T, result: T, ...args: mixed[] ): Promise<T> {
    for ( const { name, plugin } of this.plugins ) {
      const fn = plugin[ phase ];
      if ( fn ) {
        // $FlowFixMe
        const res = await fn( result, ...args, this );
        if ( res != null ) {
          result = postProcess ? postProcess( res, result, name ) : res;
        }
      }
    }
    return result;
  }

  async applyPluginPhaseSerial( phase: $Keys<Plugin>, ...args: mixed[] ) {
    for ( const { plugin } of this.plugins ) {
      const fn = plugin[ phase ];
      if ( fn ) {
        // $FlowFixMe
        await fn( ...args, this );
      }
    }
  }

  isEntry( id: string ): boolean {
    return this.entries.findIndex( e => e === id ) > -1;
  }

  isDest( id: string ): boolean {
    return id.indexOf( this.dest ) === 0;
  }

  getModule( id: string ): ?Module {
    return this.modules.get( id );
  }

  getModuleForSure( id: string ): Module {
    // $FlowFixMe
    return this.modules.get( id );
  }

  addModule( obj: ModuleArg ): Module {
    const m = new Module( obj );
    const curr = this.modules.get( m.id );
    if ( !curr ) {
      this.modules.set( m.id, m );
      const arr = this.modulesPerFile.get( m.path ) || [];
      arr.push( m );
      this.modulesPerFile.set( m.path, arr );
      this.promises.push( m.load( this ) );
      if ( m.isEntry ) {
        this.moduleEntries.add( m );
      }
      return m;
    }
    this.promises.push( curr.load( this ) );
    return curr;
  }

  resetDeps( path: string ) {
    const modules = this.modulesPerFile.get( path );
    if ( modules ) {
      modules.forEach( m => m.resetDeps() );
    }
  }

  removeFile( path: string, removed: boolean ) {
    path = lowerPath( path );

    const modules = this.modulesPerFile.get( path );
    if ( modules ) {
      this.modulesPerFile.delete( path );
      modules.forEach( m => {
        this.modules.delete( m.id );
        this.usedIds.delete( m.hashId );
        if ( m.isEntry ) {
          this.moduleEntries.delete( m );
        }
      } );
    }

    const set = this.fileSystem.fileUsedBy.get( path );
    if ( set ) {
      set.forEach( f => this.resetDeps( f ) );
    }

    if ( removed ) {
      this.fileSystem.purge( path );
    } else {
      this.fileSystem.purgeContent( path );
    }
  }

  createRuntime( obj: RuntimeArg ) {
    return createRuntime( obj );
  }

  async write( asset: FinalAsset, { data, map }: ToWrite ): Promise<Info> {

    let h;
    if ( this.hashing && !asset.isEntry ) {
      h = hash( data );
      asset.dest = addHash( asset.dest, h );
      asset.relativeDest = addHash( asset.normalized, h );
      if ( map ) {
        map.file = addHash( map.file, h );
      }
    }

    const fs = this.fs;
    const inlineMap = this.sourceMaps === "inline";
    const destPath = resolvePath( asset.dest, this.cwd );
    const directory = path.dirname( destPath );

    if ( map ) {
      map.sources = map.sources.map(
        source => relative( resolvePath( source, this.cwd ), directory )
      );
    }

    await fs.mkdirp( path.dirname( destPath ) );

    if ( map && typeof data === "string" ) {
      if ( inlineMap ) {
        await fs.writeFile( destPath, data + `\n//# ${SOURCE_MAP_URL}=${map.toUrl()}` );
      } else {
        const p1 = fs.writeFile( destPath, data + `\n//# ${SOURCE_MAP_URL}=${path.basename( destPath )}.map` );
        const p2 = fs.writeFile( destPath + ".map", map.toString() );
        await p1;
        await p2;
      }
    } else {
      await fs.writeFile( destPath, data );
    }

    return {
      file: asset.dest,
      size: data.length,
      isEntry: asset.isEntry
    };
  }

  async build() {
    const emptyDirPromise = this.cleanBeforeBuild ? fs.emptyDir( this.dest ) : Promise.resolve();

    this.fileSystem.fileUsedBy.clear();

    for ( const path of this.entries ) {
      this.addModule( {
        path,
        isEntry: true,
        builder: this
      } );
    }

    let promise;
    while ( promise = this.promises.pop() ) {
      await promise;
    }

    await this.applyPluginPhaseSerial( "checker" );

    const finalAssets = await this.applyPluginPhasePipe(
      "graphTransformer",
      null,
      await processGraph( this )
    );

    await emptyDirPromise;

    const filesInfo = await callRenderers( this, finalAssets );

    if ( this.serviceWorker.filename ) {
      const swPrecache = require( "sw-precache" );
      const serviceWorkerCode = await swPrecache.generate( this.serviceWorker );

      await fs.outputFile( this.serviceWorker.filename, serviceWorkerCode );

      filesInfo.push( {
        file: this.serviceWorker.filename,
        size: serviceWorkerCode.length,
        isEntry: false
      } );
    }

    const out = {
      filesInfo
    };

    await this.applyPluginPhaseSerial( "afterBuild", out );

    return out;
  }

}

function addHash( file: string, h: string ): string {
  const fn = m => ( m ? `.${h}` + m : `-${h}` );
  return file.replace( rehash, fn );
}

async function callRenderers(
  builder: Builder,
  finalAssets: FinalAssets
): Promise<Info[]> {
  const writes = [];
  for ( const asset of finalAssets.files ) {
    const module = builder.getModuleForSure( asset.id );
    const lang = module.lang;

    if ( lang ) {
      const out = await lang.renderAsset( builder, asset, finalAssets );
      if ( out ) {
        writes.push( builder.write( asset, out ) );
        continue;
      }
    }
    throw new Error( `Could not build asset ${asset.id}` );
  }
  return Promise.all( writes );
}
