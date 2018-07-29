// @flow
import reporter from "../reporters/installer";
import type { Name, Version, Resolved, Options, Warning } from "../types";
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

function installFromLock( opts, tree, store, lockfile, index ) {
  const [ name, version, resolved, integrity ] = lockfile.resolutions[ index ];
  const data = { name, version, resolved, integrity };

  return tree.createResolution( data, async resolution => {
    const extraction = store.extract( data );
    const deps = [];

    const indexes = lockfile.resolutions[ index ][ 4 ];
    for ( const i of indexes ) {
      deps.push( installFromLock( opts, tree, store, lockfile, i ) );
    }

    for ( const dep of deps ) {
      await dep.job;
      resolution.set.add( dep );
    }

    return store.createResolution( await extraction, resolution );
  } );
}

function install( opts, tree, store, lockfile, data ) {
  return tree.createResolution( data, async resolution => {
    const extraction = store.extract( data );
    const awaitingDeps = [];

    for ( const nameStr in data.deps ) {
      // $FlowIgnore
      const name: Name = nameStr;

      awaitingDeps.push(
        resolve( name, data.deps[ name ], opts ).then( obj => install( opts, tree, store, lockfile, obj ) )
      );
    }

    for ( const promise of awaitingDeps ) {
      const dep = await promise;
      await dep.job;
      resolution.set.add( dep );
    }

    return store.createResolution( await extraction, resolution );
  } );
}

export class Installer extends EventEmitter {

  +tree: Tree;
  +store: Store;
  +opts: Options;
  +warn: Warning => void;

  constructor( opts: Options ) {
    super();
    this.opts = opts;
    this.warn = ( warning: Warning ) => {
      this.emit( "warning", warning );
    };
    this.store = new Store( opts, this.warn );
    this.tree = new Tree();
  }

  async install() {

    const { opts, store, tree } = this;

    const [ pkg, lockfile ] = await Promise.all( [ readPkg( opts.folder ), readLockfile( opts.folder ) ] );

    const reuseLockfile = !opts.update && shouldReuseLockfile( lockfile );

    this.emit( "folder", { folder: opts.folder } );
    this.emit( "lockfile", { reusing: reuseLockfile } );
    this.emit( "start" );

    const newLockfile = createLockfile();

    const promises = [];
    const allDeps = new ResolutionSet();

    async function resolveDep( name: Name, version: Version, depType: DepType ) {
      if ( reuseLockfile ) {
        const dep = lockfile[ depType ][ name ];
        if ( dep ) {
          const { savedVersion, i } = dep;
          if ( savedVersion === version ) {
            newLockfile[ depType ][ name ] = dep;

            const resolution = installFromLock( opts, tree, store, lockfile, i );
            allDeps.add( resolution );
            return resolution.job;
          }
        }
      }

      const obj = await resolve( name, version, opts );
      newLockfile[ depType ][ name ] = { savedVersion: version, resolved: obj.resolved, i: -1 };

      const resolution = install( opts, tree, store, lockfile, obj );
      allDeps.add( resolution );
      return resolution.job;
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

    await store.linkNodeModules( opts.folder, allDeps );

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

  }

}

export default function( opts: Options ) {
  const installer = new Installer( opts );
  reporter( installer );
  return installer.install().then( () => {
    installer.emit( "done" );
  }, err => {
    installer.emit( "error", err );
  } );
}
