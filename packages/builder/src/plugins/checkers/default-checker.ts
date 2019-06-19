import blank from "../../utils/blank";
import { locToString } from "../../utils/error";
import isEmpty from "../../utils/is-empty";
import { Loc, ImportedName, ExportedName, WarnCb, ErrorCb, Checker, ICheckerImpl, FinalModule } from "../../types";

type ExportedNameAll = {
  request: string;
  imported: "*";
  name: "*";
  loc?: Loc;
};

const isExportAll = ( e: ExportedName ): e is ExportedNameAll => !!e.request && e.name === "*" && e.imported === "*";

class CheckedModule {

  private module: FinalModule;
  private id: string;
  private checker: CheckerImpl;
  private _imports: { [key: string]: boolean }|null;
  private _exports: { [key: string]: boolean }|null;
  private _exportsSingle: { [key: string]: boolean }|null;
  private _exportsAllFrom: { [key: string]: boolean }|null;

  constructor( module: FinalModule, checker: CheckerImpl ) {
    this.module = module;
    this.id = module.id;
    this.checker = checker;
    this._imports = null;
    this._exports = null;
    this._exportsSingle = null;
    this._exportsAllFrom = null;
  }

  error( msg: string, loc?: Loc ) {
    // TODO code?
    this.checker.error( this.id, msg, undefined, loc );
  }

  getImportedNames() {
    const { depsInfo } = this.module.asset;
    return ( depsInfo && depsInfo.importedNames ) || [];
  }

  getExportedNames() {
    const { depsInfo } = this.module.asset;
    return ( depsInfo && depsInfo.exportedNames ) || [];
  }

  getModule( request: string ) {
    const m = this.module.moduleIdByRequest.get( request );
    if ( !m ) {
      throw new Error( `Internal: dependency for ${JSON.stringify( request )} not found.` );
    }
    return this.checker.get( m.id );
  }

  getImports() {
    if ( !this._imports ) {
      const imports = blank();
      for ( const { name, loc } of this.getImportedNames() ) {
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

    for ( const exportedName of this.getExportedNames() ) {
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

  getAllFromExports( stack: Set<CheckedModule> = new Set() ) {
    if ( this._exportsAllFrom ) {
      return this._exportsAllFrom;
    }

    const singleExports = this.getSingleExports();
    const exportsAllFrom = blank();
    let namespaceConflict = false;

    const checkExportFrom = ( name: string, { request, loc }: ExportedNameAll ) => {
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

    stack.add( this );

    for ( const exportedName of this.getExportedNames() ) {
      if ( isExportAll( exportedName ) ) {
        const module = this.getModule( exportedName.request );

        if ( stack.has( module ) ) {
          const trace = Array.from( stack ).map( entry => entry.id );
          while ( trace[ 0 ] !== module.id ) {
            trace.shift();
          }
          const traceStr = trace.join( "->" ) + "->" + module.id;
          this.error( `Circular 'export * from "";' declarations. ${traceStr}` );
        }

        const e = module.getExports( stack );

        for ( const name in e ) {
          if ( name !== "default" ) {
            checkExportFrom( name, exportedName );
          }
        }
      }
    }

    if ( namespaceConflict ) {
      for ( const name in exportsAllFrom ) {
        this.checker.warn(
          `Re-exports '${name}' from ${exportsAllFrom[ name ].join( " and " )}. See ${this.id}`
        );
      }
    }

    stack.delete( this );

    this._exportsAllFrom = exportsAllFrom;
    return exportsAllFrom;
  }

  getExports( stack?: Set<CheckedModule> ) {
    return this._exports || ( this._exports = {
      ...this.getSingleExports(),
      ...this.getAllFromExports( stack )
    } );
  }

  checkImportsExports() {
    this.getImports();
    this.getExports();

    const check = ( { request, imported, loc }: ImportedName | ExportedName ) => {
      if ( request && imported ) {
        const exports = this.getModule( request ).getExports();

        if ( isEmpty( exports ) ) {
          this.error( `${request} exports nothing${imported === "*" ? "" : `. Looking for ${imported}`}`, loc );
        }

        if ( imported !== "*" && !exports[ imported ] ) {
          this.error( `${request} doesn't export ${imported}`, loc );
        }
      }
    };

    this.getImportedNames().forEach( check );
    this.getExportedNames().forEach( check );
  }

  reset() {
    this._exports = null;
    this._exportsAllFrom = null;
  }

}

class CheckerImpl implements ICheckerImpl {

  private warnCb: WarnCb;
  private errorCb: ErrorCb;
  private map: Map<string, CheckedModule>;

  constructor( warnCb: WarnCb, errorCb: ErrorCb ) {
    this.warnCb = warnCb;
    this.errorCb = errorCb;
    this.map = new Map();
  }

  warn( msg: string ) {
    this.warnCb( msg );
  }

  error( id: string, msg: string, code?: string, loc?: Loc ) {
    this.errorCb( id, msg, code || null, loc || null );
  }

  get( id: string ) {
    const m = this.map.get( id );
    if ( m ) {
      return m;
    }
    throw new Error( `Internal: checked module ${JSON.stringify( id )} not found.` );
  }

  newModule( module: FinalModule ) {
    this.map.set( module.id, new CheckedModule( module, this ) );
  }

  deletedModule( id: string ) {
    this.map.delete( id );
  }

  check() {
    for ( const module of this.map.values() ) {
      module.reset();
    }
    for ( const module of this.map.values() ) {
      module.checkImportsExports();
    }
  }

}

export const checker: Checker = {
  name: "quase_builder_default_checker",
  checker( _options: any, { warn, error }: { warn: WarnCb; error: ErrorCb } ) {
    return new CheckerImpl( warn, error );
  }
};

export default checker;
