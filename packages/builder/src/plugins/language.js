// @flow
import type { Loc, NotResolvedDep } from "../types";
import type { ID } from "../id";
import type Builder from "../builder";
import type Module from "../module";

export default class LanguageModule {

  +id: ID;
  +deps: NotResolvedDep[];
  builder: Builder;

  constructor( id: ID ) {
    this.id = id;
    this.deps = [];

    // $FlowFixMe
    this.builder = null; // Fill!
  }

  getModule(): Module {
    // $FlowFixMe
    return this.builder.getModule( this.id );
  }

  isEntry(): boolean {
    return this.getModule().isEntry;
  }

  addDep( dep: NotResolvedDep ): string {
    const existing = this.deps.find( ( { src } ) => src === dep.src );
    if ( existing ) {
      if ( dep.splitPoint ) {
        existing.splitPoint = true;
      }
      if ( !dep.async ) {
        existing.async = false;
      }
    } else {
      this.deps.push( dep );
    }
    return dep.src;
  }

  getMaps(): Object[] {
    // $FlowFixMe
    return this.getModule().getMaps();
  }

  getCode(): string {
    // $FlowFixMe
    return this.getModule().code;
  }

  error( message: string, loc: ?Loc ) {
    // $FlowFixMe
    return this.getModule().error( message, loc );
  }

  getModuleBySource( source: string ): ?Module {
    const dep = this.getModule().sourceToResolved.get( source );
    return dep && this.builder.getModule( dep.resolved );
  }

  getInternalBySource( source: string, internalKey: string ): Object {
    const dep = this.getModule().sourceToResolved.get( source );
    const module = dep && this.builder.getModule( dep.resolved );
    const internal = module && module.getLastOutput( internalKey );
    if ( internal ) {
      return internal;
    }
    throw this.error(
      `No information about '${source}' was found. It might be a file from a different type.`,
      dep && dep.loc
    );
  }

}
