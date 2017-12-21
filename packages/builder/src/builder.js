// @flow

import hash from "./utils/hash";
import jsPlugin from "./plugins/js";
import htmlPlugin from "./plugins/html";
import createRuntime, { type RuntimeArg } from "./runtime/create-runtime";
import processGraph from "./graph";
import type { Plugin, Transformer, Resolver, Checker, Renderer, FinalAsset, FinalAssets, ToWrite, PerformanceOpts, MinimalFS, Options } from "./types";
import { type ID, idToPath, pathToId, idToString, resolveId } from "./id";
import Module from "./module";

const FileSystem = require( "@quase/memory-fs" ).default;
const fs = require( "fs-extra" );
const prettyBytes = require( "pretty-bytes" );
const path = require( "path" );

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /(\..*)?$/;

type Info = { file: string, size: number, isEntry: boolean };

async function defaultResolver( { src }, id, builder ) {
  const resolved = path.resolve( path.dirname( idToPath( id ) ), src );
  const isFile = await builder.fileSystem.isFile( resolved );
  return isFile && resolved;
}

async function defaultRenderer( builder, asset ) {
  const module = builder.getModule( asset.id );
  return module && { code: await module.getCode() };
}

export default class Builder {

  +idEntries: ID[];
  +entries: string[];
  +context: ID;
  +dest: ID;
  +cwd: ID;
  +sourceMaps: boolean | "inline";
  +hashing: boolean;
  +warn: Function;
  +fileSystem: FileSystem;
  +fs: MinimalFS;
  +cli: Object;
  +plugins: Plugin[];
  +defaultPlugins: boolean;
  +transformers: Transformer[];
  +resolvers: Resolver[];
  +checkers: Checker[];
  +renderers: Renderer[];
  +performance: PerformanceOpts;
  +modules: Map<ID, Module>;
  +modulePromises: Promise<void>[];
  +idHashes: Set<string>;

  constructor( _opts: Options ) {

    const options: Options = _opts || { entries: [] };

    if ( !options.entries || options.entries.length === 0 ) {
      throw new Error( "Missing entries." );
    }

    this.entries = [].concat( options.entries || [] );

    if ( typeof options.context !== "string" ) {
      throw new Error( "Missing context option." );
    }

    if ( typeof options.dest !== "string" ) {
      throw new Error( "Missing dest option." );
    }

    this.cwd = pathToId( typeof options.cwd === "string" ? path.resolve( options.cwd ) : process.cwd() );
    this.context = this.resolveId( options.context );
    this.dest = this.resolveId( options.dest );
    this.idEntries = this.entries.map( e => resolveId( e, this.context ) );

    this.fileSystem = options.fileSystem ? options.fileSystem.clone() : new FileSystem();
    this.fs = options.fs || fs;

    this.sourceMaps = options.sourceMaps === "inline" ? options.sourceMaps : !!options.sourceMaps;
    this.hashing = !!options.hashing;
    this.warn = options.warn || ( () => {} );

    this.cli = options.cli || {};

    this.plugins = ( options.plugins || [] ).filter( Boolean );
    this.defaultPlugins = !!options.defaultPlugins;

    if ( this.defaultPlugins ) {
      this.plugins.push( jsPlugin() );
      this.plugins.push( htmlPlugin() );
    }

    this.transformers = this.plugins.map( ( { transform } ) => transform ).filter( Boolean );
    this.resolvers = this.plugins.map( ( { resolve } ) => resolve ).filter( Boolean );
    this.resolvers.push( defaultResolver );
    this.checkers = this.plugins.map( ( { check } ) => check ).filter( Boolean );
    this.renderers = this.plugins.map( ( { render } ) => render ).filter( Boolean );
    this.renderers.push( defaultRenderer );

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

    this.modules = new Map();
    this.modulePromises = [];
    this.idHashes = new Set();

  }

  // The watcher should use this to keep builds atomic
  clone() {
    // $FlowFixMe
    const builder = new Builder( Object.assign( {}, this ) );
    this.modules.forEach( ( m, id ) => {
      builder.modules.set( id, m.clone( builder ) );
    } );
    return builder;
  }

  idToString( id: ID | string, cwd: ID = this.cwd ): string {
    return idToString( id, cwd );
  }

  resolveId( id: ID | string, cwd: ID = this.cwd ): ID {
    return resolveId( id, cwd );
  }

  isEntry( id: ID ): boolean {
    return this.idEntries.findIndex( e => e === id ) > -1;
  }

  isDest( id: ID ): boolean {
    // $FlowFixMe
    return id.indexOf( this.dest ) === 0;
  }

  getModule( id: ID ): ?Module {
    return this.modules.get( id );
  }

  addModule( id: ID, isEntry: ?boolean ) {
    const curr = this.modules.get( id );
    if ( curr ) {
      if ( !curr.initialLoad ) {
        this.modulePromises.push( curr.saveDeps() );
      }
      return;
    }
    const module = new Module( id, !!isEntry, this );
    this.modules.set( id, module );
    this.modulePromises.push( module.saveDeps() );
  }

  removeModule( id: ID ) {
    const m = this.modules.get( id );
    if ( m ) {
      this.idHashes.delete( m.hashId );
      this.modules.delete( id );
    }
    this.fileSystem.purge( id );
  }

  createRuntime( obj: RuntimeArg ) {
    return createRuntime( obj );
  }

  async write( asset: FinalAsset, { code, map }: ToWrite ): Promise<Info> {

    let h;
    if ( this.hashing && !asset.isEntry ) {
      h = hash( code );
      asset.dest = addHash( asset.dest, h );
      asset.relativeDest = addHash( asset.normalizedId, h );
      if ( map ) {
        map.file = addHash( map.file, h );
      }
    }

    const fs = this.fs;
    const inlineMap = this.sourceMaps === "inline";
    const destPath = idToPath( this.resolveId( asset.dest ) );
    const directory = pathToId( path.dirname( destPath ) );

    if ( map ) {
      map.sources = map.sources.map(
        source => this.idToString( this.resolveId( source ), directory )
      );
    }

    await fs.mkdirp( path.dirname( destPath ) );

    if ( map && typeof code === "string" ) {
      if ( inlineMap ) {
        await fs.writeFile( destPath, code + `\n//# ${SOURCE_MAP_URL}=${map.toUrl()}` );
      } else {
        const p1 = fs.writeFile( destPath, code + `\n//# ${SOURCE_MAP_URL}=${path.basename( destPath )}.map` );
        const p2 = fs.writeFile( destPath + ".map", map.toString() );
        await p1;
        await p2;
      }
    } else {
      await fs.writeFile( destPath, code );
    }

    return {
      file: asset.dest,
      size: code.length,
      isEntry: asset.isEntry
    };
  }

  async build() {
    for ( const entry of this.idEntries ) {
      this.addModule( entry, true );
    }

    let promise;
    while ( promise = this.modulePromises.pop() ) {
      await promise;
    }

    await callCheckers( this.checkers, this );

    const finalAssets = processGraph( this );
    const filesInfo = await callRenderers( this.renderers, this, finalAssets );

    const output = [ "\nAssets:\n" ];

    if ( this.performance.hints ) {
      for ( const { file, size, isEntry } of filesInfo ) {
        if ( this.performance.assetFilter( file ) ) {

          let message = "";
          if ( isEntry && size > this.performance.maxEntrypointSize ) {
            message = ` > ${prettyBytes( this.performance.maxEntrypointSize )} [performance!]`;
          } else if ( size > this.performance.maxAssetSize ) {
            message = ` > ${prettyBytes( this.performance.maxAssetSize )} [performance!]`;
          }

          output.push( `${isEntry ? "[entry] " : ""}${this.idToString( file )} | ${prettyBytes( size )}${message}` );
        }
      }
    }

    output.push( "\n" );
    return output.join( "\n" );
  }

}

function addHash( file: string, h: string ): string {
  const fn = m => ( m ? `.${h}` + m : `-${h}` );
  return file.replace( rehash, fn );
}

async function callCheckers(
  checkers: Checker[],
  builder: Builder
): Promise<void> {
  for ( const fn of checkers ) {
    await fn( builder );
  }
}

async function callRenderers(
  renderers: Renderer[],
  builder: Builder,
  finalAssets: FinalAssets
): Promise<Info[]> {
  const usedHelpers = new Set();
  const writes = [];
  for ( const asset of finalAssets.files ) {
    for ( const fn of renderers ) {
      const out = await fn( builder, asset, finalAssets, usedHelpers );
      if ( out ) {
        if ( !asset.isEntry && out.usedHelpers ) {
          for ( const key of out.usedHelpers ) {
            usedHelpers.add( key );
          }
        }
        writes.push( builder.write( asset, out ) );
        break;
      }
    }
  }
  return Promise.all( writes );
}
