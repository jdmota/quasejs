// @flow
import hash from "./utils/hash";
import JsLanguage from "./languages/js";
import HtmlLanguage from "./languages/html";
import createRuntime, { type RuntimeArg } from "./runtime/create-runtime";
import processGraph from "./graph";
import type {
  FinalAsset, FinalAssets, ToWrite,
  Query, QueryArr, PerformanceOpts, MinimalFS, Options
} from "./types";
import { resolvePath, relative, lowerPath } from "./id";
import Language from "./language";
import FileSystem from "./filesystem";
import Module, { type ModuleArg } from "./module";
import { check } from "./checker";
import Reporter from "./reporter";

const { getPlugins, getOnePlugin } = require( "@quase/get-plugins" );
const fs = require( "fs-extra" );
const path = require( "path" );

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /(\..*)?$/;

type Info = { file: string, size: number, isEntry: boolean };

export default class Builder {

  +options: Object;
  +entries: string[];
  +context: string;
  +dest: string;
  +requests: { path: string, query: Query }[];
  +cwd: string;
  +sourceMaps: boolean | "inline";
  +hashing: boolean;
  +publicPath: string;
  +warn: Function;
  +fileSystem: FileSystem;
  +fs: MinimalFS;
  +cli: Object;
  +reporter: Function;
  +watch: boolean;
  +watchOptions: ?Object;
  +buildDefaultQuery: ( string ) => ?QueryArr;
  +loaderAlias: { [key: string]: Function };
  +languages: { [key: string]: [ Class<Language>, Object ] };
  +performance: PerformanceOpts;
  +serviceWorker: Object;
  +cleanBeforeBuild: boolean;
  +modules: Map<string, Module>;
  +modulesPerFile: Map<string, Module[]>;
  +moduleEntries: Set<Module>;
  +usedIds: Set<string>;
  +promises: Promise<void>[];

  constructor( _opts: Options ) {

    const options: Options = _opts || { entries: [] };

    if ( !Array.isArray( options.entries ) || options.entries.length === 0 ) {
      throw new Error( "Missing entries." );
    }

    if ( typeof options.context !== "string" ) {
      throw new Error( "Missing context option." );
    }

    if ( typeof options.dest !== "string" ) {
      throw new Error( "Missing dest option." );
    }

    this.options = options;

    this.cwd = typeof options.cwd === "string" ? path.resolve( options.cwd ) : process.cwd();
    this.context = resolvePath( options.context, this.cwd );
    this.dest = resolvePath( options.dest, this.cwd );

    this.publicPath = ( options.publicPath || "/" ).replace( /\/+$/, "" ) + "/";

    this.loaderAlias = options.loaderAlias || {};
    this.buildDefaultQuery = options.buildDefaultQuery || ( () => {} );
    this.languages = {
      js: [ JsLanguage, {} ],
      html: [ HtmlLanguage, {} ]
    };

    this.requests = options.entries.map( e => {
      const [ path, queryStr ] = Module.parseRequest( e );
      const query = Module.parseQuery( queryStr );
      return {
        path: resolvePath( path, this.context ),
        query: query.arr.length ? query : this.getDefaultQuery( path )
      };
    } );

    this.entries = this.requests.map( r => r.path );

    this.fileSystem = new FileSystem();
    this.fs = options.fs || fs;

    this.sourceMaps = options.sourceMaps === "inline" ? options.sourceMaps : !!options.sourceMaps;
    this.hashing = !!options.hashing;
    this.warn = options.warn || ( () => {} );

    this.cli = options.cli || {};

    getPlugins( options.languages || [] ).forEach( ( { plugin, name, options } ) => {
      if ( typeof plugin !== "function" ) {
        throw new Error( `Expected language ${name + " " || ""}to be a function` );
      }
      this.languages[ plugin.TYPE ] = [ plugin, options ];
    } );

    this.reporter = options.reporter ? getOnePlugin( options.reporter ) : Reporter;

    this.watch = !!options.watch;
    this.watchOptions = options.watchOptions;

    this.performance = Object.assign( {
      // $FlowFixMe
      hints: "warning",
      maxEntrypointSize: 250000,
      maxAssetSize: 250000,
      assetFilter( f ) {
        return !( /\.map$/.test( f ) );
      }
    }, options.performance );

    if ( this.performance.hints === true ) {
      this.performance.hints = "warning";
    }

    this.serviceWorker = Object.assign( {
      staticFileGlobs: [],
      stripPrefixMulti: {}
    }, options.serviceWorker );

    this.serviceWorker.staticFileGlobs = this.serviceWorker.staticFileGlobs.map( p => path.join( this.dest, p ) );
    this.serviceWorker.stripPrefixMulti[ `${this.dest}${path.sep}`.replace( /\\/g, "/" ) ] = this.publicPath;
    this.serviceWorker.filename = this.serviceWorker.filename ? resolvePath( this.serviceWorker.filename, this.dest ) : "";

    this.cleanBeforeBuild = !!options.cleanBeforeBuild;

    this.modules = new Map();
    this.modulesPerFile = new Map();
    this.moduleEntries = new Set();
    this.usedIds = new Set();

    this.promises = [];

  }

  getDefaultQuery( path: string ): Query {
    const arr = this.buildDefaultQuery( path ) || [];
    return {
      arr,
      str: Module.queryArrToString( arr ),
      default: true
    };
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

  removeFile( path: string ) {
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

    this.fileSystem.purge( path );
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

    for ( const request of this.requests ) {
      this.addModule( {
        request,
        isEntry: true,
        builder: this
      } );
    }

    let promise;
    while ( promise = this.promises.pop() ) {
      await promise;
    }

    // TODO custom checkers
    await check( this );

    const finalAssets = processGraph( this );

    await emptyDirPromise;

    const filesInfo = await callRenderers( this, finalAssets );

    if ( this.serviceWorker.filename ) {
      const swPrecache = require( "sw-precache" );
      const serviceWorkerCode = await swPrecache.generate( this.serviceWorker );

      await fs.writeFile( this.serviceWorker.filename, serviceWorkerCode );

      filesInfo.push( {
        file: this.serviceWorker.filename,
        size: serviceWorkerCode.length,
        isEntry: false
      } );
    }

    return {
      filesInfo
    };
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
  const usedHelpers = new Set();
  const writes = [];
  for ( const asset of finalAssets.files ) {
    const module = builder.getModuleForSure( asset.id );
    const lang = module.lang;

    if ( lang ) {
      const out = await lang.renderAsset( builder, asset, finalAssets, usedHelpers );
      if ( out ) {
        if ( !asset.isEntry && out.usedHelpers ) {
          for ( const key of out.usedHelpers ) {
            usedHelpers.add( key );
          }
        }
        writes.push( builder.write( asset, out ) );
        continue;
      }
    }
    throw new Error( `Could not build asset ${asset.id}` );
  }
  return Promise.all( writes );
}
