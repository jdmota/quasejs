// @flow

import { read as readPkg } from "./pkg";
import { read as readLockfile, write as writeLockfile } from "./lockfile";
import resolve from "./resolve";
import { Tree } from "./resolution";
import Store from "./store";

const path = require( "path" );

export type InstallOptions = {
  store: string,
  cache: string,
  offline: ?boolean,
  preferOffline: ?boolean,
  preferOnline: ?boolean,
  flat: ?boolean,
  update: ?boolean,
  check: ?boolean
};

type DepType = "deps" | "devDeps" | "optionalDeps";

type Deps = { [name: string]: { savedVersion: string, resolved: string, i: number } };

// TODO refactor out lockfile logic, and check for validity of it

// [ name, version, resolution, integrity, deps ]
export type Entry = [string, string, string, string, number[]];

const LOCK_VERSION = "1"; // TODO deal with different versions

type Lockfile = {
  v: string,
  resolutions: Entry[],
  deps: Deps,
  devDeps: Deps,
  optionalDeps: Deps,
};

/* eslint no-await-in-loop: 0 */

export default async function( folder: string, _opts: Object ) {

  const opts: InstallOptions = Object.assign( {}, _opts );
  if ( opts.store == null ) {
    opts.store = Store.DEFAULT;
  }
  if ( opts.offline == null && opts.preferOnline == null ) {
    opts.preferOffline = true;
  }
  opts.cache = path.join( opts.store, "cache" );

  const configPromises = [ readPkg( folder ), readLockfile( folder ) ];
  const pkg = await configPromises[ 0 ];
  const lockfile = ( await configPromises[ 1 ]: Lockfile );

  const newLockfile: Lockfile = {
    v: LOCK_VERSION,
    resolutions: [],
    deps: {},
    devDeps: {},
    optionalDeps: {}
  };

  const store = new Store();
  const tree = new Tree();

  const promises = [];

  async function installFromLock( index ) {
    const [ name, version, resolved, integrity ] = lockfile.resolutions[ index ];
    const obj = { name, version, resolved, integrity };

    const res = await tree.createResolution( obj, async set => {
      const extraction = store.extract( obj.resolved, opts );
      const promises = [];

      const indexes = lockfile.resolutions[ index ][ 4 ];
      for ( const i of indexes ) {
        promises.push( installFromLock( i ) );
      }

      for ( const p of promises ) {
        set.add( await p );
      }
      await extraction;
    } );

    await store.createResolution( res, opts );
    return res;
  }

  async function install( obj ) {
    const res = await tree.createResolution( obj, async set => {
      const extraction = store.extract( obj.resolved, opts );
      const promises = [];

      for ( const name in obj.deps ) {
        promises.push(
          resolve( name, obj.deps[ name ], opts ).then( install )
        );
      }

      for ( const p of promises ) {
        set.add( await p );
      }
      await extraction;
    } );

    await store.createResolution( res, opts );
    return res;
  }

  const allDeps = [];

  async function resolveDep( name: string, version: string, depType: DepType ) {
    if ( !opts.update ) {
      const deps = lockfile[ depType ] || {};
      const { savedVersion, resolved, i } = deps[ name ] || {};
      if ( savedVersion === version ) {
        newLockfile[ depType ][ name ] = deps[ name ];
        allDeps.push( resolved );
        return installFromLock( i );
      }
    }

    const obj = await resolve( name, version, opts );
    newLockfile[ depType ][ name ] = { savedVersion: version, resolved: obj.resolved, i: -1 };
    allDeps.push( obj.resolved );
    return install( obj );
  }

  for ( const name in pkg.dependencies ) {
    promises.push( resolveDep( name, pkg.dependencies[ name ], "deps" ) );
  }

  for ( const name in pkg.devDependencies ) {
    promises.push( resolveDep( name, pkg.devDependencies[ name ], "devDeps" ) );
  }

  await Promise.all( promises );
  await store.linkNodeModules( folder, await tree.extractDeps( allDeps ), opts, true );

  const map: Map<string, number> = new Map();
  tree.generate( newLockfile.resolutions, map );

  for ( const name in newLockfile.deps ) {
    // $FlowFixMe
    newLockfile.deps[ name ].i = map.get( newLockfile.deps[ name ].resolved );
  }

  for ( const name in newLockfile.devDeps ) {
    // $FlowFixMe
    newLockfile.devDeps[ name ].i = map.get( newLockfile.devDeps[ name ].resolved );
  }

  await writeLockfile( folder, newLockfile );

}
