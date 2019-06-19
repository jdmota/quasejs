export abstract class AbstractRegistry<K, V> {

  private map: Map<K, V>;

  constructor() {
    this.map = new Map();
  }

  abstract factory( id: K ): V;

  exists( id: K ): boolean {
    return this.map.has( id );
  }

  get( id: K ): V {
    const thing = this.map.get( id );
    if ( thing ) {
      return thing;
    }
    throw new Error( `Assertion error: ${id} does not exist` );
  }

  add( id: K ) {
    let thing = this.map.get( id );
    if ( thing ) {
      return thing;
    }
    thing = this.factory( id );
    this.map.set( id, thing );
    return thing;
  }

}
