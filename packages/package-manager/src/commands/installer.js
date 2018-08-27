// @flow
import { InstallReporter } from "../reporters/installer";
import type { Name, Resolved, Options, Warning } from "../types";
import { error, mapGet } from "../utils";
import { read as readPkg, readGlobal as readGlobalPkg } from "../pkg";
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

const path = require( "path" );

export class Installer {

  +store: Store;
  +opts: Options;
  +reporter: InstallReporter;
  +tree: Tree;
  +rootDeps: ResolutionSet;
  +warn: Warning => void;
  reuseLockfile: boolean;

  constructor( opts: Options, reporter: InstallReporter ) {
    this.opts = opts;
    this.reporter = reporter;
    this.warn = ( warning: Warning ) => {
      this.reporter.warning( warning );
    };
    this.store = new Store( opts, this );
    this.tree = new Tree();
    this.rootDeps = new ResolutionSet();
    this.reuseLockfile = false;
  }

  async resolution( pkg: Object, lockfile: Lockfile, newLockfile: Lockfile ) {
    this.reporter.resolutionStart();
    const resolver = new Resolver( this, pkg, lockfile, newLockfile );
    await resolver.start();
  }

  async extraction() {

    const extractions = [];
    this.tree.forEach( resolution => {
      extractions.push( this.store.extract( resolution ).then( () => this.reporter.extractionUpdate() ) );
    } );

    this.reporter.extractionStart( extractions.length );

    for ( const p of extractions ) {
      await p;
    }
  }

  async linking() {

    const links = [];
    this.tree.forEach( resolution => {
      links.push( this.store.linkResolutionDeps( resolution ).then( () => this.reporter.linkingUpdate() ) );
    } );

    this.reporter.linkingStart( links.length );

    for ( const p of links ) {
      await p;
    }
  }

  async localLinking() {
    this.reporter.localLinkingStart( 1 );
    await this.store.linkNodeModules( this.opts.folder, this.rootDeps );
    this.reporter.localLinkingUpdate();
  }

  async updateLockfile( newLockfile: Lockfile ) {

    this.reporter.updateLockfile();

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

  async install( forceUpdate: ?boolean ) {

    const { opts } = this;

    const [ pkg, lockfile ] = await Promise.all( [
      opts.global ? readGlobalPkg( opts.folder ) : readPkg( opts.folder ),
      readLockfile( opts.folder )
    ] );

    if ( this.opts.frozenLockfile && forceUpdate ) {
      throw error( "Cannot use --frozen-lockfile and upgrade at the same time" );
    }

    const reuseLockfile = this.reuseLockfile = !forceUpdate && shouldReuseLockfile( lockfile );

    if ( this.opts.frozenLockfile && !reuseLockfile ) {
      throw error( "Lockfile not found." );
    }

    this.reporter.folder( { folder: opts.folder } );
    this.reporter.lockfile( { reusing: reuseLockfile } );
    this.reporter.start();

    const newLockfile = createLockfile();

    await this.resolution( pkg, lockfile, newLockfile );
    await this.extraction();
    await this.linking();
    await this.localLinking();

    if ( !this.opts.frozenLockfile ) {
      await this.updateLockfile( newLockfile );
    }

    if ( opts.global ) {
      const PATH = ( process.env.PATH || "" ).split( path.delimiter );
      const bin = path.resolve( opts.folder, "node_modules", ".bin" );
      if ( !PATH.includes( bin ) ) {
        this.reporter.warning( {
          code: "NOT_IN_PATH",
          message: `${bin} does not seem to be in PATH. Please add it manually.`
        } );
      }
    }
  }

}

export default function( opts: Options, forceUpdate: ?boolean ) {
  const reporter = new InstallReporter();
  const installer = new Installer( opts, reporter );
  return installer.install( forceUpdate ).then( () => {
    reporter.done();
  }, err => {
    reporter.error( err );
  } );
}
