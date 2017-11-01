// @flow

import FileSystem from "../../fs/src/file-system";
import hash from "./utils/hash";
import processGraph from "./graph";
import type { Plugin, Resolver, Checker, Renderer, ToWrite, Options } from "./types";
import { type ID, idToString, resolveId } from "./id";
import Module from "./module";

const fs = require( "fs-extra" );
const path = require( "path" );

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /(\..*)?$/;

const runtimeCode = fs.readFile( path.resolve( __dirname, "runtime/runtime.min.js" ), "utf8" );

const runtimeReplace = {
  babel: "{__BABEL_HELPERS__:1}",
  idToFile: "{__ID_TO_FILE_HERE__:1}"
};

export default class Builder {

  idEntries: [ID, ID][];
  entries: [string, string][];
  cwd: string;
  commonChunks: ID;
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
  modules: Map<ID, Module>;
  uuid: number;

  constructor( _opts: Options ) {

    const options: Options = _opts || { entries: [] };

    this.cwd = typeof options.cwd === "string" ? path.resolve( options.cwd ) : process.cwd(); // Default: process.cwd()
    this.entries = ( options.entries || [] );
    this.idEntries = this.entries.map( ( [ a, b ] ) => [
      this.resolveId( a ),
      this.resolveId( b )
    ] );

    if ( this.entries.length === 0 ) {
      throw new Error( "Missing entries." );
    }

    if ( typeof options.commonChunks !== "string" ) {
      throw new Error( "Missing commonChunks options." );
    }

    this.commonChunks = this.resolveId( options.commonChunks );

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

  idToString( id: ID | string ): string {
    return idToString( id, this.cwd );
  }

  resolveId( id: ID | string ): ID {
    return resolveId( id, this.cwd );
  }

  isEntry( id: ID ): boolean {
    return this.idEntries.findIndex( e => e[ 0 ] === id ) > -1;
  }

  isDest( id: ID ): boolean {
    return this.idEntries.findIndex( e => e[ 1 ] === id ) > -1;
  }

  getModule( id: string ): ?Module {
    return this.modules.get( this.resolveId( id ) );
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

    dest = path.resolve( this.cwd, dest );

    const fs = this.fs;
    const inlineMap = this.sourceMaps === "inline";
    const directory = path.dirname( dest );

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
        source => path.relative( directory, path.resolve( this.cwd, source ) ).replace( /\\/g, "/" )
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
    for ( const [ entry ] of this.idEntries ) {
      promises.push( this.addModule( entry ) );
    }
    await Promise.all( promises );

    await callCheckers( this.checkers, this );

    const finalModules = processGraph( this );
    await callRenderers( this.renderers, this, finalModules );
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
  finalModules: Object[]
): Promise<void> {
  const writes = [];
  const write = builder.write.bind( builder );
  for ( const fn of array ) {
    const out = await fn( builder, finalModules );
    writes.push( out.map( write ) );
  }
  await Promise.all( writes );
}
