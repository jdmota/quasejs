// @flow

import type { Name, ExactVersion, Resolved, Integrity } from "./types";
import type { Entry } from "./lockfile";

const crypto = require( "crypto" );

function hash( input ) {
  return crypto.createHash( "md5" ).update( input ).digest( "hex" ).slice( 0, 10 );
}

const STRING_VERSION = "1\n";

export type Data = {
  name: Name,
  version: ExactVersion,
  resolved: Resolved,
  integrity: Integrity
};

export interface ImmutableResolution {
  +data: Data;
  +set: ImmutableResolutionSet; // eslint-disable-line no-use-before-define
  buildFlat( arr: Array<Entry>, map: ?Map<Resolved, number> ): number;
  hashCode(): string;
}

export interface ImmutableResolutionSet {
  +size: number;
  forEach( callback: ImmutableResolution => ?boolean ): void;
  buildFlat( arr: Array<Entry>, map: ?Map<Resolved, number> ): Array<Entry>;
}

class Resolution implements ImmutableResolution {

  data: Data;
  set: ImmutableResolutionSet;
  _hashCode: ?string;
  _string: ?string;

  static compare( curr: ImmutableResolution, next: ImmutableResolution ) {
    if ( curr === next ) return 0;
    if ( curr.data.resolved === next.data.resolved ) return 0;
    if ( curr.data.resolved < next.data.resolved ) return -1;
    return 1;
  }

  constructor( data: Data, set: ImmutableResolutionSet ) {
    this.data = data;
    this.set = set;
    this._hashCode = null;
    this._string = null;
  }

  hashCode() {
    if ( this._hashCode == null ) {
      this._hashCode = hash( this.toString() );
    }
    return this._hashCode;
  }

  toString() {
    if ( this._string == null ) {
      const arr = [];
      this.buildFlat( arr );
      this._string = STRING_VERSION + arr.map( ( [ , , resolved, , deps ] ) => `${resolved},${deps.join( "," )}` ).join( "\n" );
    }
    return this._string;
  }

  buildFlat( arr: Array<Entry>, _map: ?Map<Resolved, number> ): number {

    const map = _map || new Map();

    const { resolved } = this.data;
    const deps = [];
    const entry: Entry = [ this.data.name, this.data.version, resolved, this.data.integrity, deps ];

    const idx = arr.push( entry ) - 1;

    this.set.forEach( resolution => {
      deps.push( resolution.buildFlat( arr, map ) );
    } );

    const currIdx = map.get( resolved );

    if ( currIdx == null ) {
      map.set( resolved, idx );
      return idx;
    }

    arr.pop();
    return currIdx;
  }

}

type Node = {
  value: ImmutableResolution,
  left: ?Node,
  right: ?Node
};

class ResolutionSet implements ImmutableResolutionSet {

  size: number;
  _root: ?Node;

  constructor() {
    this.size = 0;
    this._root = null;
  }

  buildFlat( arr: Array<Entry>, _map: ?Map<Resolved, number> ): Array<Entry> {
    const map = _map || new Map();
    this.forEach( resolution => {
      resolution.buildFlat( arr, map );
    } );
    return arr;
  }

  traverse( node: Node, callback: ImmutableResolution => ?boolean ) {

    const left = node.left;
    const right = node.right;

    if ( left ) {
      this.traverse( left, callback );
    }

    if ( callback( node.value ) === false ) {
      return;
    }

    if ( right ) {
      this.traverse( right, callback );
    }

  }

  forEach( callback: ImmutableResolution => ?boolean ) {
    if ( this._root ) {
      this.traverse( this._root, callback );
    }
  }

  _node( value: ImmutableResolution ): Node {
    this.size++;
    return {
      value: value,
      left: null,
      right: null
    };
  }

  add( value: ImmutableResolution ): ImmutableResolution {

    if ( this._root == null ) {
      this._root = this._node( value );
      return value;
    }

    let current = this._root;

    while ( true ) {

      const c = Resolution.compare( current.value, value );

      if ( c > 0 ) {

        if ( current.left ) {
          current = current.left;
        } else {
          current.left = this._node( value );
          return value;
        }

      } else if ( c < 0 ) {

        if ( current.right ) {
          current = current.right;
        } else {
          current.right = this._node( value );
          return value;
        }

      } else {
        return current.value;
      }

    }

    throw new Error( "Unreachable" ); // eslint-disable-line

  }

}

type Cb = ( set: ResolutionSet ) => Promise<any>;

async function createResolution( globalSet: ResolutionSet, data: Data, callback: Cb ): Promise<ImmutableResolution> {
  const set = new ResolutionSet();
  await callback( set );
  return globalSet.add( new Resolution( data, set ) );
}

export class Tree {

  set: ResolutionSet;
  map: Map<Resolved, Promise<ImmutableResolution>>;

  constructor() {
    this.set = new ResolutionSet();
    this.map = new Map();
  }

  async createResolution( data: Data, callback: Cb ): Promise<ImmutableResolution> {
    let p = this.map.get( data.resolved );
    if ( !p ) {
      p = createResolution( this.set, data, callback );
      this.map.set( data.resolved, p );
    }
    return p;
  }

  generate( arr: Array<Entry>, map: Map<Resolved, number> ) {
    this.set.buildFlat( arr, map );
  }

  async extractDeps( allDeps: Resolved[] ): Promise<ImmutableResolutionSet> {
    const set = new ResolutionSet();
    for ( const key of allDeps ) {
      // $FlowFixMe
      set.add( await this.map.get( key ) ); // eslint-disable-line no-await-in-loop
    }
    return set;
  }

}
