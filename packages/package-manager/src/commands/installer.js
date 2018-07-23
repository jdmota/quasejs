// @flow
import reporter from "../reporters/installer";
import type { Name, Version, Resolved, Options } from "../types";
import { mapGet } from "../utils";
import { read as readPkg } from "../pkg";
import {
  shouldReuse as shouldReuseLockfile,
  create as createLockfile,
  read as readLockfile,
  write as writeLockfile
} from "../lockfile";
import resolve from "../resolve";
import { ResolutionSet, Tree } from "../resolution";
import Store from "../store";

const { EventEmitter } = require( "events" );

type DepType = "deps" | "devDeps" | "optionalDeps";

async function installFromLock( opts, tree, store, lockfile, index ) {
  const [ name, version, resolved, integrity ] = lockfile.resolutions[ index ];
  const data = { name, version, resolved, integrity };

  return tree.createResolution( data, async resolution => {
    const extraction = store.extract( data );
    const promises = [];

    const indexes = lockfile.resolutions[ index ][ 4 ];
    for ( const i of indexes ) {
      promises.push( installFromLock( opts, tree, store, lockfile, i ) );
    }

    for ( const p of promises ) {
      resolution.set.add( await p );
    }

    return store.createResolution( await extraction, resolution );
  } );
}

async function install( opts, tree, store, lockfile, data ) {
  return tree.createResolution( data, async resolution => {
    const extraction = store.extract( data );
    const promises = [];

    for ( const nameStr in data.deps ) {
      // $FlowIgnore
      const name: Name = nameStr;

      promises.push(
        resolve( name, data.deps[ name ], opts ).then( obj => install( opts, tree, store, lockfile, obj ) )
      );
    }

    for ( const p of promises ) {
      resolution.set.add( await p );
    }

    return store.createResolution( await extraction, resolution );
  } );
}

export class Installer extends EventEmitter {

  +tree: Tree;
  +store: Store;
  +opts: Options;

  constructor( opts: Options ) {
    super();
    this.opts = opts;
    this.store = new Store( opts );
    this.tree = new Tree();
  }

  async install() {

    this.emit( "start" );

    const { opts, store, tree } = this;

    const [ pkg, lockfile ] = await Promise.all( [ readPkg( opts.folder ), readLockfile( opts.folder ) ] );

    const reuseLockfile = !opts.update && shouldReuseLockfile( lockfile );

    this.emit( "folder", { folder: opts.folder } );
    this.emit( "lockfile", { reusing: reuseLockfile } );

    const newLockfile = createLockfile();

    const promises = [];
    const allDeps = [];

    async function resolveDep( name: Name, version: Version, depType: DepType ) {
      if ( reuseLockfile ) {
        const dep = lockfile[ depType ][ name ];
        if ( dep ) {
          const { savedVersion, i } = dep;
          if ( savedVersion === version ) {
            newLockfile[ depType ][ name ] = dep;

            const installation = installFromLock( opts, tree, store, lockfile, i );
            allDeps.push( installation );
            return installation;
          }
        }
      }

      const obj = await resolve( name, version, opts );
      newLockfile[ depType ][ name ] = { savedVersion: version, resolved: obj.resolved, i: -1 };

      const installation = install( opts, tree, store, lockfile, obj );
      allDeps.push( installation );
      return installation;
    }

    for ( const nameStr in pkg.dependencies ) {
      // $FlowIgnore
      const name: Name = nameStr;

      promises.push( resolveDep( name, pkg.dependencies[ name ], "deps" ) );
    }

    for ( const nameStr in pkg.devDependencies ) {
      // $FlowIgnore
      const name: Name = nameStr;

      promises.push( resolveDep( name, pkg.devDependencies[ name ], "devDeps" ) );
    }

    this.emit( "jobsStart", { count: promises.length } );

    for ( const p of promises ) {
      await p;
      this.emit( "jobDone" );
    }

    this.emit( "linking" );

    const allDepsSet = new ResolutionSet();
    for ( const d of allDeps ) {
      allDepsSet.add( await d );
    }
    await store.linkNodeModules( opts.folder, allDepsSet, true );

    this.emit( "updateLockfile" );

    const map: Map<Resolved, number> = new Map();
    tree.generate( newLockfile.resolutions, map );

    for ( const nameStr in newLockfile.deps ) {
      // $FlowIgnore
      const name: Name = nameStr;

      newLockfile.deps[ name ].i = mapGet( map, newLockfile.deps[ name ].resolved );
    }

    for ( const nameStr in newLockfile.devDeps ) {
      // $FlowIgnore
      const name: Name = nameStr;

      newLockfile.devDeps[ name ].i = mapGet( map, newLockfile.devDeps[ name ].resolved );
    }

    await writeLockfile( opts.folder, newLockfile );

    this.emit( "done" );

  }

}

export default function( opts: Options ) {
  const installer = new Installer( opts );
  reporter( installer );
  return installer.install();
}
