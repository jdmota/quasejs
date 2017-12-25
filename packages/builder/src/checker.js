// @flow
import blank from "./utils/blank";
import error from "./utils/error";
import isEmpty from "./utils/is-empty";
import { locToString } from "./utils/loc";
import type { Loc } from "./types";
import type Builder from "./builder";
import type Module from "./module";

export class Checker {

  +module: Module;
  +builder: Builder;
  +id: string;
  _imports: ?{ [key: string]: boolean };
  _exports: ?{ [key: string]: boolean };

  constructor( module: Module, builder: Builder ) {
    this.module = module;
    this.builder = builder;
    this.id = module.id;
    this._imports = null;
    this._exports = null;
  }

  error( msg: string, loc: ?Loc ) {
    this.module.error( msg, loc );
  }

  getModule( request: ?string ): Module {
    const dep = this.module.moduleDeps.find( dep => dep.request === request );
    if ( !dep ) {
      throw new Error( `Internal error: dependency for ${JSON.stringify( request )} not found.` );
    }
    return this.builder.getModuleForSure( dep.requiredId );
  }

  getImports() {
    if ( !this._imports ) {
      const imports = blank();
      this.module.importedNames.forEach( ( { name, loc } ) => {
        if ( imports[ name ] ) {
          this.error( `Duplicate import ${name}`, loc );
        }
        imports[ name ] = true;
      } );
      this._imports = imports;
    }
    return this._imports;
  }

  getExports( stack: Map<Module, boolean> = new Map() ) {
    if ( this._exports ) {
      return this._exports;
    }

    const exports = blank();
    const exportsAllFrom = blank();
    let namespaceConflict = false;

    const checkExport = ( { name, loc } ) => {
      if ( exports[ name ] ) {
        this.error( `Duplicate export ${name}`, loc );
      }
      exports[ name ] = true;
    };

    const checkExportFrom = ( name, { request, loc } ) => {
      // $FlowFixMe
      const text = `${request} (${locToString( loc )})`;
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

    stack.set( this.module, true );

    const isExportAll = e => e.request && e.name === "*" && e.imported === "*";

    this.module.exportedNames.forEach( exportedName => {
      if ( !isExportAll( exportedName ) ) {
        checkExport( exportedName );
      }
    } );

    this.module.exportedNames.forEach( exportedName => {
      if ( isExportAll( exportedName ) ) {
        const module = this.getModule( exportedName.request );

        if ( stack.has( module ) ) {
          const trace = Array.from( stack ).map( entry => entry[ 0 ].id );
          while ( trace[ 0 ] !== module.id ) {
            trace.shift();
          }
          const traceStr = trace.join( "->" ) + "->" + module.id;
          error( `Circular 'export * from "";' declarations. ${traceStr}` );
        }

        const e = module.checker.getExports( stack );

        for ( const name in e ) {
          if ( name !== "default" ) {
            checkExportFrom( name, exportedName );
          }
        }
      }
    } );

    stack.delete( this.module );

    if ( namespaceConflict ) {
      for ( const name in exportsAllFrom ) {
        this.builder.warn(
          `Re-exports '${name}' from ${exportsAllFrom[ name ].join( " and " )}. See ${this.id}`
        );
      }
    }

    this._exports = exports;
    return exports;
  }

  checkImportsExports() {
    this.getImports();
    this.getExports();

    const check = ( { request, imported, loc } ) => {
      if ( request && imported ) {
        const exports = this.getModule( request ).checker.getExports();

        if ( isEmpty( exports ) ) {
          this.error( `${request} exports nothing`, loc );
        }

        if ( imported !== "*" && !exports[ imported ] ) {
          this.error( `${request} doesn't export ${imported}`, loc );
        }
      }
    };

    this.module.importedNames.forEach( check );
    this.module.exportedNames.forEach( check );
  }

}

export function check( builder: Builder ) {
  for ( const [ , module ] of builder.modules ) {
    module.checker.checkImportsExports();
  }
}
