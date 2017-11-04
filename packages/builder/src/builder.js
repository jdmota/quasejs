// @flow

import FileSystem from "../../fs/src/file-system";
import hash from "./utils/hash";
import processGraph from "./graph";
import type { Plugin, Resolver, Checker, Renderer, FinalModules, ToWrite, PerformanceOpts, Options } from "./types";
import { type ID, idToPath, pathToId, idToString, resolveId } from "./id";
import Module from "./module";

const fs = require( "fs-extra" );
const prettyBytes = require( "pretty-bytes" );
const path = require( "path" );

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /(\..*)?$/;

const runtimeCode = fs.readFile( path.resolve( __dirname, "runtime/runtime.min.js" ), "utf8" );

export default class Builder {

  idEntries: ID[];
  entries: string[];
  context: ID;
  dest: ID;
  cwd: ID;
  sourceMaps: boolean | "inline";
  hashing: boolean;
  warn: Function;
  fileSystem: FileSystem;
  fs: {
    writeFile: Function,
    mkdirp: Function
  };
  cli: Object;
  plugins: Plugin[];
  resolvers: Resolver[];
  checkers: Checker[];
  renderers: Renderer[];
  performance: PerformanceOpts;
  modules: Map<ID, Module>;
  uuid: number;

  constructor( _opts: Options ) {

    const options: Options = _opts || { entries: [] };

    this.entries = ( options.entries || [] );

    if ( this.entries.length === 0 ) {
      throw new Error( "Missing entries." );
    }

    if ( typeof options.context !== "string" ) {
      throw new Error( "Missing context option." );
    }

    if ( typeof options.dest !== "string" ) {
      throw new Error( "Missing dest option." );
    }

    this.cwd = pathToId( typeof options.cwd === "string" ? path.resolve( options.cwd ) : process.cwd() ); // Default: process.cwd()
    this.context = this.resolveId( options.context );
    this.dest = this.resolveId( options.dest );
    this.idEntries = this.entries.map( e => resolveId( e, this.context ) );

    this.fileSystem = options.fileSystem || new FileSystem();
    this.fs = options.fs || fs;

    this.sourceMaps = options.sourceMaps === "inline" ? options.sourceMaps : !!options.sourceMaps;
    this.hashing = !!options.hashing;
    this.warn = options.warn || ( () => {} );

    this.cli = options.cli || {};

    this.plugins = options.plugins || [];
    this.resolvers = options.resolvers || [];
    this.checkers = options.checkers || [];
    this.renderers = options.renderers || [];

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
    this.uuid = options.uuid || 0;

  }

  async getRuntime(): Promise<string> {
    return runtimeCode;
  }

  // The watcher should use this to keep builds atomic
  clone() {
    // $FlowFixMe
    const builder = new Builder( Object.assign( {}, this ) );
    this.modules.forEach( ( m, id ) => {
      builder.modules.set( id, m.clone( builder ) );
    } );
    builder.fileSystem = this.fileSystem.clone();
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

  async addModule( id: ID ): Promise<Module> {
    const curr = this.modules.get( id );
    if ( curr ) {
      if ( curr.uuid !== this.uuid ) {
        await curr.saveDeps();
      }
      return curr;
    }
    const module = new Module( id, this );
    this.modules.set( id, module );
    await module.saveDeps();
    return module;
  }

  async write( { dest, code, map }: ToWrite ) {

    dest = idToPath( this.resolveId( dest ) );

    const fs = this.fs;
    const inlineMap = this.sourceMaps === "inline";
    const directory = pathToId( path.dirname( dest ) );

    if ( this.hashing ) {
      const h = hash( code );
      const fn = m => ( m ? `.${h}` + m : `-${h}` );
      dest = dest.replace( rehash, fn );
      if ( map ) {
        map.file = map.file.replace( rehash, fn );
      }
    }

    if ( map ) {
      map.sources = map.sources.map(
        source => this.idToString( this.resolveId( source ), directory )
      );
    }

    await fs.mkdirp( path.dirname( dest ) );

    if ( map && typeof code === "string" ) {
      if ( inlineMap ) {
        await fs.writeFile( dest, code + `\n//# ${SOURCE_MAP_URL}=${map.toUrl()}` );
      } else {
        const p1 = fs.writeFile( dest, code + `\n//# ${SOURCE_MAP_URL}=${path.basename( dest )}.map` );
        const p2 = fs.writeFile( dest + ".map", map.toString() );
        await p1;
        await p2;
      }
    } else {
      await fs.writeFile( dest, code );
    }
  }

  async build() {
    this.uuid++;

    const promises = [];
    for ( const entry of this.idEntries ) {
      promises.push( this.addModule( entry ) );
    }
    await Promise.all( promises );

    await callCheckers( this.checkers, this );

    const finalModules = processGraph( this );
    const filesInfo = await callRenderers( this.renderers, this, finalModules );

    const output = [ "\nAssets:\n" ];

    if ( this.performance.hints ) {
      for ( const { file, size } of filesInfo ) {
        if ( this.performance.assetFilter( file ) ) {

          const isEntry = this.isEntry(
            this.resolveId( this.idToString( file, this.dest ), this.context )
          );

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

async function callCheckers(
  array: Checker[],
  builder: Builder
): Promise<void> {
  for ( const fn of array ) {
    await fn( builder );
  }
}

async function callRenderers(
  array: Renderer[],
  builder: Builder,
  finalModules: FinalModules
): Promise<{file: string, size: number}[]> {
  const filesInfo = [];
  const writes = [];
  for ( const fn of array ) {
    const out = await fn( builder, finalModules );
    for ( const o of out ) {
      writes.push( builder.write( o ) );
      filesInfo.push( {
        file: o.dest,
        size: o.code.length
      } );
    }
  }
  await Promise.all( writes );
  return filesInfo;
}
