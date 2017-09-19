import { joinSourceMaps } from "../../source-map/src";
import blank from "./utils/blank";
import error from "./utils/error";

function isEmpty( obj ) {
  for ( const name in obj ) {
    return false;
  }
  return true;
}

export default class Module {

  constructor( { id, originalCode, originalMap, code, mapsChain, finalMap, ast, deps, bundle } ) {
    this.id = id;
    this.normalizedId = bundle.normalizeId( id );
    this.originalCode = originalCode;
    this.originalMap = originalMap;

    this.code = code;
    this.mapsChain = mapsChain;
    this.finalMap = bundle.sourceMaps && ( finalMap || joinSourceMaps( mapsChain ) );
    this.ast = ast;

    this.bundle = bundle;

    // type Name = { name: string, loc: { line, column } }

    this.deps = deps;
    this.sources = deps.sources; // Name[]
    this.exportAllSources = deps.exportAllSources; // Name[]
    this.importSources = deps.importSources; // source: string -> Name[] (to check if a source exports these names)
    this.exportSources = deps.exportSources; // source: string -> Name[] (to check if a source exports these names)
    this.importNames = deps.importNames; // Name[] (imported names)
    this.exportNames = deps.exportNames; // Name[] (exported names, except the ones from exportAllSources)

    // These should be reset between builds
    this.uuid = null;
    this._render = null;
    this._imports = null;
    this._exports = null;
    this.resolvedDepsMap = null; // source: string -> resolved: string
    this._exportAllModules = null;
  }

  clone( bundle ) {
    if ( !bundle ) {
      throw new Error( "module needs bundle" );
    }
    return new Module( {
      id: this.id,
      originalCode: this.originalCode,
      originalMap: this.originalMap,
      code: this.code,
      mapsChain: this.mapsChain,
      finalMap: this.finalMap,
      ast: this.ast,
      deps: this.deps,
      bundle
    } );
  }

  // After the initialization of this module, resolveAndFetchDeps() is the first thing to be called
  resolveAndFetchDeps() {
    if ( this.resolvedDepsMap ) {
      return; // Already resolving...
    }

    this.resolvedDepsMap = new Map();

    return Promise.all(
      this.sources.map( ( { name, loc } ) => {
        if ( !name ) {
          error( "Empty import", this, loc );
        }
        return this.bundle.resolveId( name, this, loc ).then( dep => {
          if ( dep === this.id ) {
            error( "A module cannot import itself", this, loc );
          }
          this.resolvedDepsMap.set( name, dep );
          return this.bundle.fetchModule( dep, this.id );
        } );
      } )
    );
  }

  getModuleBySource( sourceName ) {
    return this.bundle.modules.get( this.resolvedDepsMap.get( sourceName ) );
  }

  forEachDependency( callback ) {
    this.sources.forEach( ( { name } ) => callback( this.getModuleBySource( name ) ) );
  }

  get exportAllModules() {
    if ( !this._exportAllModules ) {
      this._exportAllModules = this.exportAllSources.map( ( { name } ) => this.getModuleBySource( name ) );
    }
    return this._exportAllModules;
  }

  get imports() {
    return this.getImports();
  }

  getImports() {
    if ( !this._imports ) {
      const imports = blank();
      this.importNames.forEach( ( { name, loc } ) => {
        if ( imports[ name ] ) {
          error( `Duplicate import ${name}`, this, loc );
        }
        imports[ name ] = true;
      } );
      this._imports = imports;
    }
    return this._imports;
  }

  get exports() {
    return this.getExports();
  }

  getExports( stack ) {

    if ( this._exports ) {
      return this._exports;
    }

    const exports = blank();
    const exportsAllFrom = blank();
    let namespaceConflict = false;

    if ( !stack ) {
      stack = new Map();
    }

    const checkExport = ( { name, loc } ) => {
      if ( exports[ name ] ) {
        error( `Duplicate export ${name}`, this, loc );
      }
      exports[ name ] = true;
    };

    const checkExportFrom = ( name, fromId ) => {
      const text = `${fromId.name} (${fromId.loc.line}:${fromId.loc.column})`;
      if ( exportsAllFrom[ name ] ) {
        exportsAllFrom[ name ].push( text );
      } else {
        exportsAllFrom[ name ] = [ text ];
      }
      if ( exports[ name ] ) {
        namespaceConflict = true;
      }
      exports[ name ] = true;
    };

    this.exportNames.forEach( checkExport );

    stack.set( this, true );

    this.exportAllModules.forEach( ( module, i ) => {

      if ( stack.has( module ) ) {
        const trace = Array.from( stack ).map( entry => entry[ 0 ].normalizedId );
        while ( trace[ 0 ] !== module.normalizedId ) {
          trace.shift();
        }
        const traceStr = trace.join( "->" ) + "->" + module.normalizedId;
        error( `Circular 'export * from "";' declarations. ${traceStr}` );
      }

      const e = module.getExports( stack );

      for ( const name in e ) {
        if ( name !== "default" ) {
          checkExportFrom( name, this.exportAllSources[ i ] );
        }
      }

    } );

    stack.delete( this );

    if ( namespaceConflict ) {
      for ( const name in exportsAllFrom ) {
        this.bundle.warn( `Re-exports '${name}' from ${exportsAllFrom[ name ].join( " and " )}. See ${this.normalizedId}` );
      }
    }

    this._exports = exports;
    return exports;
  }

  checkImportsExports() {
    this.getImports();
    this.getExports();
    const check = ( names, source ) => {
      const m = this.getModuleBySource( source );
      const exports = m.getExports();
      if ( names.length > 0 && isEmpty( exports ) ) {
        error( `${source} exports nothing`, this, names[ 0 ].loc );
      }
      names.forEach( ( { name, loc } ) => {
        if ( name !== "*" && !exports[ name ] ) {
          error( `${source} doesn't export ${name}`, this, loc );
        }
      } );
    };
    this.importSources.forEach( check );
    this.exportSources.forEach( check );
    this.exportAllSources.forEach( ( { name, loc } ) => {
      const m = this.getModuleBySource( name );
      const exports = m.getExports();
      if ( isEmpty( exports ) ) {
        error( `${name} exports nothing`, this, loc );
      }
    } );
  }

}
