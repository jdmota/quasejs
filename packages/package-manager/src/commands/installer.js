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
import { Tree } from "../resolution";
import Store from "../store";

const { EventEmitter } = require( "events" );

type DepType = "deps" | "devDeps" | "optionalDeps";

async function installFromLock( opts, tree, store, lockfile, index ) {
  const [ name, version, resolved, integrity ] = lockfile.resolutions[ index ];
  const obj = { name, version, resolved, integrity };

  const res = await tree.createResolution( obj, async set => {
    const extraction = store.extract( obj.resolved, opts, obj.integrity );
    const promises = [];

    const indexes = lockfile.resolutions[ index ][ 4 ];
    for ( const i of indexes ) {
      promises.push( installFromLock( opts, tree, store, lockfile, i ) );
    }

    for ( const p of promises ) {
      set.add( await p );
    }
    await extraction;
  } );

  await store.createResolution( res );
  return res;
}

async function install( opts, tree, store, lockfile, obj ) {
  const res = await tree.createResolution( obj, async set => {
    const extraction = store.extract( obj.resolved, opts, obj.integrity );
    const promises = [];

    for ( const nameStr in obj.deps ) {
      // $FlowIgnore
      const name: Name = nameStr;

      promises.push(
        resolve( name, obj.deps[ name ], opts ).then( obj => install( opts, tree, store, lockfile, obj ) )
      );
    }

    for ( const p of promises ) {
      set.add( await p );
    }
    await extraction;
  } );

  await store.createResolution( res );
  return res;
}

export class Installer extends EventEmitter {

  +tree: Tree;
  +store: Store;
  +opts: Options;

  constructor( opts: Options ) {
    super();
    this.opts = opts;
    this.store = new Store( opts.store );
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
          const { savedVersion, resolved, i } = dep;
          if ( savedVersion === version ) {
            newLockfile[ depType ][ name ] = dep;
            allDeps.push( resolved );
            return installFromLock( opts, tree, store, lockfile, i );
          }
        }
      }

      const obj = await resolve( name, version, opts );
      newLockfile[ depType ][ name ] = { savedVersion: version, resolved: obj.resolved, i: -1 };
      allDeps.push( obj.resolved );
      return install( opts, tree, store, lockfile, obj );
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

    await store.linkNodeModules( opts.folder, await tree.extractDeps( allDeps ), true );

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
