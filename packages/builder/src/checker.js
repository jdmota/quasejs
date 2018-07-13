// @flow
import blank from "./utils/blank";
import error from "./utils/error";
import isEmpty from "./utils/is-empty";
import { locToString } from "./utils/loc";
import type { Loc } from "./types";
import type Builder from "./builder";
import type Module from "./module";

const isExportAll = e => e.request && e.name === "*" && e.imported === "*";

export class Checker {

  +module: Module;
  +builder: Builder;
  +id: string;
  +normalized: string;
  _imports: ?{ [key: string]: boolean };
  _exports: ?{ [key: string]: boolean };
  _exportsSingle: ?{ [key: string]: boolean };
  _exportsAllFrom: ?{ [key: string]: boolean };

  constructor( module: Module, builder: Builder ) {
    this.module = module;
    this.builder = builder;
    this.id = module.id;
    this.normalized = module.normalized;
    this._imports = null;
    this._exports = null;
    this._exportsSingle = null;
    this._exportsAllFrom = null;
  }

  error( msg: string, loc: ?Loc ) {
    this.module.error( msg, loc );
  }

  getModule( request: string ): Module {
    const m = this.module.getModuleByRequest( request );
    if ( !m ) {
      throw new Error( `Internal: dependency for ${JSON.stringify( request )} not found.` );
    }
    return m;
  }

  getImports() {
    if ( !this._imports ) {
      const imports = blank();
      for ( const { name, loc } of this.module.getImportedNames() ) {
        if ( imports[ name ] ) {
          this.error( `Duplicate import ${name}`, loc );
        }
        imports[ name ] = true;
      }
      this._imports = imports;
    }
    return this._imports;
  }

  getSingleExports() {
    if ( this._exportsSingle ) {
      return this._exportsSingle;
    }

    const exports = blank();

    for ( const exportedName of this.module.getExportedNames() ) {
      if ( !isExportAll( exportedName ) ) {
        if ( exports[ exportedName.name ] ) {
          this.error( `Duplicate export ${exportedName.name}`, exportedName.loc );
        }
        exports[ exportedName.name ] = true;
      }
    }

    this._exportsSingle = exports;
    return exports;
  }

  getAllFromExports( stack: Set<Module> = new Set() ) {
    if ( this._exportsAllFrom ) {
      return this._exportsAllFrom;
    }

    const singleExports = this.getSingleExports();
    const exportsAllFrom = blank();
    let namespaceConflict = false;

    const checkExportFrom = ( name, { request, loc } ) => {
      // $FlowIgnore
      const text = `${request} (${locToString( loc )})`;
      if ( singleExports[ name ] || exportsAllFrom[ name ] ) {
        namespaceConflict = true;
      }
      if ( exportsAllFrom[ name ] ) {
        exportsAllFrom[ name ].push( text );
      } else {
        exportsAllFrom[ name ] = [ text ];
      }
    };

    stack.add( this.module );

    for ( const exportedName of this.module.getExportedNames() ) {
      if ( isExportAll( exportedName ) ) {
        // $FlowIgnore
        const module = this.getModule( exportedName.request );

        if ( stack.has( module ) ) {
          const trace = Array.from( stack ).map( entry => entry.normalized );
          while ( trace[ 0 ] !== module.normalized ) {
            trace.shift();
          }
          const traceStr = trace.join( "->" ) + "->" + module.normalized;
          error( `Circular 'export * from "";' declarations. ${traceStr}` );
        }

        const e = module.checker.getExports( stack );

        for ( const name in e ) {
          if ( name !== "default" ) {
            checkExportFrom( name, exportedName );
          }
        }
      }
    }

    if ( namespaceConflict ) {
      for ( const name in exportsAllFrom ) {
        this.builder.warn(
          `Re-exports '${name}' from ${exportsAllFrom[ name ].join( " and " )}. See ${this.normalized}`
        );
      }
    }

    stack.delete( this.module );

    this._exportsAllFrom = exportsAllFrom;
    return exportsAllFrom;
  }

  getExports( stack: Set<Module> | void ) {
    return this._exports || ( this._exports = {
      ...this.getSingleExports(),
      ...this.getAllFromExports( stack )
    } );
  }

  checkImportsExports() {
    this.getImports();
    this.getExports();

    const check = ( { request, imported, loc } ) => {
      if ( request && imported ) {
        const exports = this.getModule( request ).checker.getExports();

        if ( isEmpty( exports ) ) {
          this.error( `${request} exports nothing${imported === "*" ? "" : `. Looking for ${imported}`}`, loc );
        }

        if ( imported !== "*" && !exports[ imported ] ) {
          this.error( `${request} doesn't export ${imported}`, loc );
        }
      }
    };

    this.module.getImportedNames().forEach( check );
    this.module.getExportedNames().forEach( check );
  }

  reset() {
    if ( !isEmpty( this._exportsAllFrom ) ) {
      this._exports = null;
      this._exportsAllFrom = null;
    }
  }

}

export function check( builder: Builder ) {
  for ( const [ , module ] of builder.modules ) {
    module.checker.reset();
  }
  for ( const [ , module ] of builder.modules ) {
    module.checker.checkImportsExports();
  }
}
