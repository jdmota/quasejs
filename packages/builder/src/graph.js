// @flow

import { type ID, idToPath } from "./id";
import type Builder from "./builder";
import { type Deps } from "./types";

const path = require( "path" );

// Adapted from https://github.com/samthor/srcgraph

class BiMap {

  deps: Map<ID, Deps>;
  incs: Map<ID, ID[]>;
  entrypoints: Set<ID>;

  constructor( builder: Builder ) {
    this.deps = new Map();
    this.incs = new Map();
    this.entrypoints = new Set( builder.idEntries );

    for ( const [ id, module ] of builder.modules ) {
      this.deps.set( id, module.deps || [] );
    }

    for ( const src of this.deps.keys() ) {
      this.incs.set( src, [ src ] );
    }

    this.deps.forEach( ( required, src ) => {
      required.forEach( ( { resolved, splitPoint } ) => {
        if ( splitPoint ) {
          this.entrypoints.add( resolved );
        }
        const l = this.incs.get( resolved );
        if ( l && l.indexOf( src ) === -1 ) {
          l.push( src );
        }
      } );
    } );

    this.incs.forEach( value => value.sort() );
  }

  requires( src ) {
    return this.deps.get( src ) || [];
  }

  requiredBy( src ) {
    return this.incs.get( src ) || [];
  }
}

export default function processGraph( builder: Builder ) {
  const map = new BiMap( builder );
  const entrypoints = Array.from( map.entrypoints );

  // walk over graph and set (1<<n) for all demands
  const hashes = new Map();
  entrypoints.forEach( ( entrypoint, n ) => {
    const pending = new Set( [ entrypoint ] );
    pending.forEach( next => {
      hashes.set( next, ( hashes.get( next ) || 0 ) | ( 1 << n ) );
      map.requires( next ).forEach( ( { resolved } ) => pending.add( resolved ) );
    } );
  } );

  // find all files in the same module
  const grow = from => {
    const hash = hashes.get( from );
    const wouldSplitSrc = src => {
      // entrypoints are always their own starting point
      if ( entrypoints.includes( src ) ) {
        return true;
      }
      // checks that the src is the given hash, AND has inputs only matching that hash
      if ( hashes.get( src ) !== hash ) {
        return true;
      }
      const all = map.requiredBy( src );
      return all.some( other => hashes.get( other ) !== hash );
    };

    // not a module entrypoint
    if ( !wouldSplitSrc( from ) ) {
      return null;
    }

    const include = [ from ];
    const seen = new Set( include );

    for ( let i = 0, curr; curr = include[ i ]; ++i ) {
      const pending = map.requires( curr );
      for ( let j = 0, cand; cand = pending[ j ]; ++j ) {
        if ( seen.has( cand.resolved ) ) {
          continue;
        }
        seen.add( cand.resolved );
        if ( !wouldSplitSrc( cand.resolved ) ) {
          include.push( cand.resolved );
        }
      }
    }

    return include;
  };

  const modules = [];
  hashes.forEach( ( hash, id ) => {
    const srcs = grow( id );
    if ( srcs ) {
      const entrypoint = entrypoints.includes( id );
      modules.push( {
        id,
        srcs,
        entrypoint,
        dest: path.resolve( idToPath( builder.dest ), builder.idToString( id, builder.context ) ),
        built: false
      } );
    }
  } );

  return modules;
}
