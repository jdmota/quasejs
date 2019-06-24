// @flow
import { hash } from "./utils";
import { toStr } from "./types";
import type { AliasName, Resolved, PartialResolvedObj } from "./types";
import type { Entry } from "./lockfile";

const VERSION = 1;

// A package resolution
export class Resolution {

  +data: PartialResolvedObj;
  +deps: Map<AliasName, Resolution>;
  +depsAlias: AliasName[];
  filesFolder: string;
  resFolder: string;
  _hashCode: ?string;
  _string: ?string;

  static compare( curr: Resolution, next: Resolution ) {
    if ( curr === next ) return 0;
    // $FlowIgnore
    const currData: { resolved: string } = curr.data;
    // $FlowIgnore
    const nextData: { resolved: string } = next.data;
    return currData.resolved.localeCompare( nextData.resolved );
  }

  constructor( data: PartialResolvedObj ) {
    this.data = data;
    this.deps = new Map();
    this.depsAlias = [];
    this.filesFolder = "";
    this.resFolder = "";
    this._hashCode = null;
    this._string = null;
  }

  addDep( alias: AliasName, resolution: Resolution ) {
    if ( this.deps.has( alias ) ) {
      throw new Error( `${toStr( alias )} already exists in ${toStr( this.data.resolved )}` );
    }
    this.deps.set( alias, resolution );
    this.depsAlias.push( alias );
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
      this._string = VERSION + "\n" + arr.map(
        ( [ , , resolved, integrity, deps ] ) => JSON.stringify( [ resolved, integrity, deps ] )
      ).join( "\n" );
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

    const deps = {};
    const entry: Entry = [
      this.data.name,
      this.data.version,
      resolved,
      this.data.integrity,
      deps
    ];

    const idx = arr.push( entry ) - 1;
    map.set( resolved, idx );

    this.forEach( ( alias, resolution ) => {
      deps[ toStr( alias ) ] = resolution.buildFlat( arr, map );
    } );

    return idx;
  }

  forEach( cb: ( AliasName, Resolution ) => void ) {
    const allAlias = this.depsAlias.sort();

    for ( const alias of allAlias ) {
      // $FlowIgnore
      const resolution: Resolution = this.deps.get( alias );
      cb( alias, resolution );
    }
  }

}

type Node = {
  value: Resolution,
  left: ?Node,
  right: ?Node
};

// A set of sorted resolutions
export class ResolutionSet {

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

  traverse( node: Node, callback: Resolution => void ) {

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

  forEach( callback: Resolution => void ) {
    if ( this._root ) {
      this.traverse( this._root, callback );
    }
  }

  _node( value: Resolution ): Node {
    this.size++;
    return {
      value: value,
      left: null,
      right: null
    };
  }

  add( value: Resolution ): Resolution {

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

  forEach( cb: Resolution => void ) {
    this.set.forEach( cb );
  }

  createResolution( data: PartialResolvedObj ): { isNew: boolean, resolution: Resolution } {
    const resolution = new Resolution( data );
    const prev = this.set.add( resolution );
    if ( resolution === prev ) {
      return {
        isNew: true,
        resolution
      };
    }
    return {
      isNew: false,
      resolution: prev
    };
  }

  generate( arr: Array<Entry>, map: Map<Resolved, number> ) {
    this.set.buildFlat( arr, map );
  }

}
