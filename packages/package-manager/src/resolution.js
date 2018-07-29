// @flow
import { hash } from "./utils";
import { toStr } from "./types";
import type { Name, Resolved, PartialResolvedObj } from "./types";
import type { Entry } from "./lockfile";

const VERSION = 1;
const EMPTY_PROMISE = new Promise( () => {} );

export interface ImmutableResolution {
  +data: PartialResolvedObj;
  +set: ImmutableResolutionSet; // eslint-disable-line no-use-before-define
  +job: Promise<{ filesFolder: string, resFolder: string }>;
  buildFlat( arr: Array<Entry>, map: ?Map<Resolved, number> ): number;
  hashCode(): string;
}

export interface ImmutableResolutionSet {
  +size: number;
  has( name: Name ): boolean;
  forEach( callback: ImmutableResolution => void ): void;
  buildFlat( arr: Array<Entry>, map: ?Map<Resolved, number> ): Array<Entry>;
}

// A package resolution
class Resolution implements ImmutableResolution {

  +data: PartialResolvedObj;
  +set: ResolutionSet; // eslint-disable-line no-use-before-define
  job: Promise<{ filesFolder: string, resFolder: string }>;
  _hashCode: ?string;
  _string: ?string;

  static compare( curr: ImmutableResolution, next: ImmutableResolution ) {
    if ( curr === next ) return 0;
    const a = toStr( curr.data.resolved );
    const b = toStr( next.data.resolved );
    if ( a === b ) return 0;
    if ( a < b ) return -1;
    return 1;
  }

  constructor( data: PartialResolvedObj ) {
    this.data = data;
    this.set = new ResolutionSet();
    this._hashCode = null;
    this._string = null;
    this.job = EMPTY_PROMISE;
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
      this._string = VERSION + "\n" + arr.map( ( [ , , resolved, integrity, deps ] ) => `${toStr( resolved )},${toStr( integrity )},${deps.join( "," )}` ).join( "\n" );
    }
    return this._string;
  }

  buildFlat( arr: Array<Entry>, _map: ?Map<Resolved, number> ): number {

    const map = _map || new Map();
    const { resolved } = this.data;

    const currIdx = map.get( resolved );

    if ( currIdx != null ) {
      return currIdx;
    }

    const deps = [];
    const entry: Entry = [ this.data.name, this.data.version, resolved, this.data.integrity, deps ];

    const idx = arr.push( entry ) - 1;
    map.set( resolved, idx );

    this.set.forEach( resolution => {
      deps.push( resolution.buildFlat( arr, map ) );
    } );

    return idx;
  }

}

type Node = {
  value: ImmutableResolution,
  left: ?Node,
  right: ?Node
};

// A set of sorted resolutions
export class ResolutionSet implements ImmutableResolutionSet {

  +names: Set<Name>;
  size: number;
  _root: ?Node;

  constructor() {
    this.names = new Set();
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

  traverse( node: Node, callback: ImmutableResolution => void ) {

    const left = node.left;
    const right = node.right;

    if ( left ) {
      this.traverse( left, callback );
    }

    callback( node.value );

    if ( right ) {
      this.traverse( right, callback );
    }

  }

  forEach( callback: ImmutableResolution => void ) {
    if ( this._root ) {
      this.traverse( this._root, callback );
    }
  }

  has( name: Name ): boolean {
    return this.names.has( name );
  }

  _node( value: ImmutableResolution ): Node {
    this.names.add( value.data.name );
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

export class Tree {

  +set: ResolutionSet;

  constructor() {
    this.set = new ResolutionSet();
  }

  createResolution( data: PartialResolvedObj, job: Resolution => Promise<{ filesFolder: string, resFolder: string }> ): ImmutableResolution {
    const resolution = new Resolution( data );
    const prev = this.set.add( resolution );
    if ( resolution === prev ) {
      resolution.job = job( resolution );
      return resolution;
    }
    return prev;
  }

  generate( arr: Array<Entry>, map: Map<Resolved, number> ) {
    this.set.buildFlat( arr, map );
  }

}
