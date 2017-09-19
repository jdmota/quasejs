import blank from "./utils/blank";
import error from "./utils/error";
import first from "./utils/first";
import ensureArray from "./utils/ensure-array";
import hash from "./utils/hash";
import Module from "./module";
import defaultPlugin from "./default-plugin";
import jsPlugin from "./js-plugin";
import FileSystem from "./file-system";
// import optionsSchema, { errorsText } from "./options-schema";

const fs = require( "fs-extra" );
const path = require( "path" );
// const Ajv = require( "ajv" );

function isObjectLike( obj ) {
  return obj !== null && typeof obj === "object";
}

// Ref http://www.2ality.com/2015/07/es6-module-exports.html
// Ref https://github.com/rauschma/module-bindings-demo

// FIRST resolveId( importee, importer, bundle ): string
// FIRST load( id, bundle ): string|{code,map}
// ALL transform( {code,map}, id ): {code,map}
// FIRST parse( code ): ast
// FIRST getDeps( {code,ast} ): {sources,exportAllSources,importSources,exportSources,importNames,exportNames}
// FIRST render( bundle ): []{dest,code,map?}

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /\[hash\]/ig;

export default class Bundle {

  async write( { dest, code, map } ) {

    const fs = this.fs;
    const inlineMap = this.sourceMaps === "inline";
    const directory = path.dirname( dest );

    if ( rehash.test( dest ) ) {
      const h = hash( code );
      dest = dest.replace( rehash, h );
      map.file = map.file.replace( rehash, h );
    }

    if ( map ) {
      map.sources = map.sources.map(
        source => path.relative( directory, path.resolve( this.cwd, source ) ).replace( /\\/g, "/" )
      );
    }

    await fs.mkdirp( path.dirname( dest ) );

    if ( map ) {
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

  static normalizeOptions( options ) {

    /* const ajv = new Ajv( {
      verbose: true,
      allErrors: true
    } );
    const validate = ajv.compile( optionsSchema );
    const valid = validate( options );

    if ( !valid ) {
      console.log( errorsText( validate.errors ) );
    }*/

    const normalized = blank();

    normalized.cwd = options && typeof options.cwd === "string" ? path.resolve( options.cwd ) : process.cwd(); // Default: process.cwd()
    normalized.treeshake = !!( options && options.treeshake ); // Default: false

    normalized.sourceMaps = options.sourceMaps == null ? true : options.sourceMaps; // Default: true

    if ( normalized.builds ) {
      normalized.builds.map( build => {
        build.entries = build.entries.map( par => {
          return [
            path.resolve( normalized.cwd, par[ 0 ] ),
            path.resolve( normalized.cwd, par[ 1 ] )
          ];
        } );
      } );
    }

    normalized.babelOpts = options.babelOpts || {};
    normalized.resolve = options.resolve || {};
    normalized.cli = options.cli || {};

    normalized.onwarn = options.onwarn || ( () => {} );
    normalized.fs = options.fs || fs;

    normalized.plugins = ensureArray( options.plugins );
    normalized.plugins.push( jsPlugin() );
    normalized.plugins.push( defaultPlugin );

    // Entries
    normalized.entries = options.entries.map( par => {
      return [
        path.resolve( normalized.cwd, par[ 0 ] ),
        path.resolve( normalized.cwd, par[ 1 ] )
      ];
    } );

    // For resolveId()
    normalized.resolveIdFn = first(
      normalized.plugins.map( plugin => plugin.resolveId ).filter( Boolean )
    );

    // For load()
    normalized.loadFn = first(
      normalized.plugins.map( plugin => plugin.load ).filter( Boolean )
    );

    // For parse()
    normalized.parseFn = first(
      normalized.plugins.map( plugin => plugin.parse ).filter( Boolean )
    );

    // For getDeps()
    normalized.getDepsFn = first(
      normalized.plugins.map( plugin => plugin.getDeps ).filter( Boolean )
    );

    // For render()
    normalized.renderFn = first(
      normalized.plugins.map( plugin => plugin.render ).filter( Boolean )
    );

    normalized.fileSystem = options.fileSystem || new FileSystem();

    normalized.__normalized = true;

    return normalized;

  }

  constructor( options ) {

    this.options = options.__normalized ? options : Bundle.normalizeOptions( options );

    this.modules = new Map();
    this.fileSystem = this.options.fileSystem;

    this.cwd = this.options.cwd;
    this.treeshake = this.options.treeshake;
    this.sourceMaps = this.options.sourceMaps;
    this.warn = this.onwarn = this.options.onwarn;
    this.fs = this.options.fs;
    this.plugins = this.options.plugins;
    this.entries = this.options.entries;

    this.resolveIdFn = this.options.resolveIdFn;
    this.loadFn = this.options.loadFn;
    this.parseFn = this.options.parseFn;
    this.getDepsFn = this.options.getDepsFn;
    this.renderFn = this.options.renderFn;

    if ( !options.__normalized ) {
      this.plugins.forEach( plugin => {
        if ( plugin.options ) {
          plugin.options( this.options, this );
        }
      } );
    }

  }

  normalizeId( id ) {
    return path.relative( this.cwd, id ).replace( /\\/g, "/" );
  }

  async resolveId( importee, moduleImporter, loc ) {

    const id = await this.resolveIdFn( importee, moduleImporter.id, this );

    if ( !id ) {
      error( `Could not resolve ${importee}`, moduleImporter, loc );
    }

    if ( this.entries.find( e => e[ 1 ] === id ) ) {
      error( "Don't import the destination file", moduleImporter, loc );
    }

    return id;
  }

  async load( id, importer ) {

    let result;

    try {
      result = await this.loadFn( id, this );
    } catch ( err ) {

      const from = importer ? ` (imported by ${this.normalizeId( importer )})` : "";

      if ( /^ENOENT: no such/.test( err.message ) ) {
        error( `Could not find ${this.normalizeId( id )}${from}` );
      } else {
        error( `Could not load ${this.normalizeId( id )}${from}: ${err.message}` );
      }

    }

    if ( typeof result === "string" ) {
      return {
        code: result,
        map: null
      };
    }

    if ( isObjectLike( result ) && result.code ) {
      return result;
    }

    error( `Error loading ${this.normalizeId( id )}: load hook should return a string or a { code, map? } object` );
  }

  transform( result, id ) {

    const originalCode = result.code;
    const originalMap = typeof result.map === "string" ? JSON.parse( result.map ) : result.map;
    const mapsChain = originalMap ? [ originalMap ] : [];

    return this.plugins.reduce( ( promise, plugin ) => {

      return promise.then( previous => {

        if ( !plugin.transform ) {
          return previous;
        }

        return Promise.resolve( plugin.transform( previous, id ) ).then( result => {

          if ( result == null ) {
            return previous;
          }

          if ( typeof result === "string" ) {
            result = {
              code: result,
              map: null
            };
          } else {
            result = Object.assign( {}, result );
          }

          if ( !result.code && !result.map ) {
            return previous;
          }

          if ( typeof result.map === "string" ) {
            result.map = JSON.parse( result.map );
          }

          if ( this.sourceMaps ) {
            if ( result.map ) {
              mapsChain.push( result.map );
            } else {
              // TODO warn
            }
          }

          return result;
        } );

      } ).catch( err => {
        error( `Error transforming ${this.normalizeId( id )}${plugin.name ? ` with '${plugin.name}' plugin` : ""}: ${err.message}` );
      } );

    }, Promise.resolve( result ) )

      .then( ( { code } ) => {
        return { code, mapsChain, originalCode, originalMap };
      } );

  }

  async parse( code, id ) {

    let ast;

    try {
      ast = await this.parseFn( code );
    } catch ( err ) {
      error( `Error parsing ${this.normalizeId( id )}: ${err.message}` );
    }

    if ( !isObjectLike( ast ) ) {
      error( `Could not parse ${this.normalizeId( id )}` );
    }

    return ast;
  }

  getDeps( result ) {
    return this.getDepsFn( result );
  }

  async fetchModule( id, importer ) {

    if ( this.modules.has( id ) ) {

      const module = this.modules.get( id );

      if ( module ) {
        return module.resolveAndFetchDeps();
      }

      return null;
    }

    // To make short-circuit cycles possible
    this.modules.set( id, null );

    const loadResult = await this.load( id, importer );

    const { code, mapsChain, originalCode, originalMap } = await this.transform( loadResult, id );

    const ast = await this.parse( code, id );

    const deps = await this.getDeps( { code, ast }, id );

    const module = new Module( {
      id,
      code,
      mapsChain,
      ast,
      originalCode,
      originalMap,
      deps,
      bundle: this
    } );

    this.modules.set( id, module );

    return module.resolveAndFetchDeps();
  }

  checkImportsExports() {
    this.modules.forEach( module => module.checkImportsExports() );
  }

  async render() {
    const result = await this.renderFn( this );
    if ( Array.isArray( result ) ) {
      return result;
    }
    error( "The render() method should output an array with { dest, code, map? } objects." );
  }

  async build() {

    await Promise.all(
      this.entries.map( ( [ entry ] ) => {
        this.fileSystem.filesThatTriggerBuild.add( entry );
        return this.fetchModule( entry, null );
      } )
    );

    this.checkImportsExports();

    const result = await this.render();

    return Promise.all( result.map( r => this.write( r ) ) );
  }

  // The watcher should use this to keep builds atomic
  clone() {
    const bundle = new Bundle( this.options );
    this.modules.forEach( ( m, id ) => {
      if ( m ) {
        bundle.modules.set( id, m.clone( bundle ) );
      }
    } );
    bundle.fileSystem = this.fileSystem.clone();
    return bundle;
  }

}
