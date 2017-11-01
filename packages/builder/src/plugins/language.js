import { joinSourceMaps } from "../../../source-map/src";
import error from "../utils/error";

export default class LanguageModule {

  constructor( id ) {
    this.id = id;
    this.deps = [];
    this.builder = null; // Fill!
  }

  addDep( dep ) {
    if ( !this.deps.find( ( { src } ) => src === dep.src ) ) {
      this.deps.push( dep );
    }
    return dep.src;
  }

  getMaps() {
    const m = this.builder.getModule( this.id );
    return m.outputs.map( o => o.map ).filter( Boolean );
  }

  getCode() {
    return this.builder.getModule( this.id ).code;
  }

  error( message, loc ) {
    error( message, {
      id: this.builder.idToString( this.id ),
      code: this.getCode(),
      map: joinSourceMaps( this.getMaps() )
    }, loc );
  }

  getModuleBySource( source ) {
    const dep = this.builder.getModule( this.id ).sourceToResolved.get( source );
    return dep && this.builder.getModule( dep.resolved );
  }

  getInternalBySource( source, internalKey ) {
    const dep = this.builder.getModule( this.id ).sourceToResolved.get( source );
    const module = dep && this.builder.getModule( dep.resolved );
    const internal = module && module.getLastOutput( internalKey );
    if ( internal ) {
      return internal;
    }
    this.error(
      `No information about '${source}' was found. It might be a file from a different type.`,
      dep && dep.loc
    );
  }

}
