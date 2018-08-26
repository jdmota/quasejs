// @flow
import reporter from "../reporters/installer";
import type { Name, Resolved, Options, Warning } from "../types";
import { mapGet } from "../utils";
import { read as readPkg, validate as validatePkg } from "../pkg";
import {
  type Lockfile,
  shouldReuse as shouldReuseLockfile,
  create as createLockfile,
  read as readLockfile,
  write as writeLockfile
} from "../lockfile";
import { ResolutionSet, Tree } from "../resolution";
import Store from "../store";
import { Resolver } from "../resolve";

const { EventEmitter } = require( "events" );

export class Installer extends EventEmitter {

  +tree: Tree;
  +rootDeps: ResolutionSet;
  +store: Store;
  +opts: Options;
  +warn: Warning => void;
  reuseLockfile: boolean;

  constructor( opts: Options ) {
    super();
    this.opts = opts;
    this.warn = ( warning: Warning ) => {
      this.emit( "warning", warning );
    };
    this.store = new Store( opts, this.warn );
    this.tree = new Tree();
    this.rootDeps = new ResolutionSet();
    this.reuseLockfile = false;
  }

  async resolution( pkg: Object, lockfile: Lockfile, newLockfile: Lockfile ) {
    this.emit( "resolutionStart" );
    const resolver = new Resolver( this, pkg, lockfile, newLockfile );
    await resolver.start();
  }

  async extraction() {

    const extractions = [];
    this.tree.forEach( resolution => {
      extractions.push( this.store.extract( resolution ).then( () => this.emit( "extractionUpdate" ) ) );
    } );

    this.emit( "extractionStart", extractions.length );

    for ( const p of extractions ) {
      await p;
    }
  }

  async linking() {

    const links = [];
    this.tree.forEach( resolution => {
      links.push( this.store.linkResolutionDeps( resolution ).then( () => this.emit( "linkingUpdate" ) ) );
    } );

    this.emit( "linkingStart", links.length );

    for ( const p of links ) {
      await p;
    }
  }

  async localLinking() {
    this.emit( "localLinkingStart", 1 );
    await this.store.linkNodeModules( this.opts.folder, this.rootDeps );
    this.emit( "localLinkingUpdate" );
  }

  async updateLockfile( newLockfile: Lockfile ) {

    this.emit( "updateLockfile" );

    const map: Map<Resolved, number> = new Map();
    this.tree.generate( newLockfile.resolutions, map );

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

    await writeLockfile( this.opts.folder, newLockfile );
  }

  async install() {

    const { opts } = this;
    const [ pkg, lockfile ] = await Promise.all( [ readPkg( opts.folder ), readLockfile( opts.folder ) ] );

    validatePkg( pkg );

    const reuseLockfile = this.reuseLockfile = !opts.update && shouldReuseLockfile( lockfile );

    this.emit( "folder", { folder: opts.folder } );
    this.emit( "lockfile", { reusing: reuseLockfile } );
    this.emit( "start" );

    const newLockfile = createLockfile();

    await this.resolution( pkg, lockfile, newLockfile );
    await this.extraction();
    await this.linking();
    await this.localLinking();
    await this.updateLockfile( newLockfile );
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
