// @flow

import { encode, decode, type Snapshots } from "./encode-decode";

const fs = require( "fs-extra" );
const path = require( "path" );
const concordance = require( "concordance" );
const _writeFileAtomic = require( "write-file-atomic" );

function writeFileAtomic( filename, data, options ) {
  return new Promise( ( resolve, reject ) => {
    _writeFileAtomic( filename, data, options, ( err, value ) => {
      if ( err ) {
        reject( err );
      } else {
        resolve( value );
      }
    } );
  } );
}

function tryDecode( file: string ): Snapshots {
  try {
    return decode( fs.readFileSync( file ), file );
  } catch ( err ) {
    if ( err.code === "ENOENT" ) {
      return new Map();
    }
    throw err;
  }
}

class SnapshotMissmatch extends Error {
  +diff: string;
  constructor( diff: string ) {
    super( "Snapshot missmatch" );
    this.name = "SnapshotMissmatch";
    this.diff = diff;
  }
}

type Stats = { added: number, removed: number, updated: number };

function getSnapPath( filePath: string ): string {
  return filePath + ".snap";
}

export default class SnapshotsManager {

  testKey: string;
  +filePath: string;
  +snapPath: string;
  +reportPath: string;
  +prevSnapshots: Snapshots;
  +newSnapshots: Snapshots;
  +reports: Map<string, Object>;
  +updating: boolean;
  +stats: Stats;
  +concordanceOptions: Object;
  loaded: boolean;

  constructor( filePath: string, concordanceOptions: Object, updating: ?boolean ) {
    this.testKey = "";
    this.filePath = filePath;
    this.snapPath = getSnapPath( filePath );
    this.reportPath = this.snapPath.replace( /\.snap$/, ".md" );
    this.prevSnapshots = tryDecode( this.snapPath );
    this.newSnapshots = new Map();
    this.reports = new Map();
    this.updating = !!updating;
    this.stats = {
      added: 0,
      removed: 0,
      updated: 0
    };
    this.concordanceOptions = concordanceOptions;
    this.loaded = false;
  }

  setTest( test: { fullname: string } ) {
    this.testKey = test.fullname;
  }

  toMatchSnapshot( actual: any, key: any ) {
    if ( typeof key === "string" ) {
      this.testKey = key;
    }

    if ( this.newSnapshots && this.newSnapshots.has( this.testKey ) ) {
      throw new Error( `Key ${this.testKey} was already used.` );
    }

    const expectedBuffer = this.prevSnapshots.get( this.testKey );

    if ( expectedBuffer === undefined || this.updating ) {

      const actualDescribe = concordance.describe( actual, this.concordanceOptions );
      const actualBuffer = concordance.serialize( actualDescribe );

      // Add new snapshot
      this.newSnapshots.set( this.testKey, actualBuffer );
      this.reports.set( this.testKey, actualDescribe );

      if ( expectedBuffer === undefined ) {
        this.stats.added++;
      } else {
        if ( !expectedBuffer.equals( actualBuffer ) ) {
          this.stats.updated++;
        }
      }

    } else {

      const expectedDescribe = concordance.deserialize( expectedBuffer, this.concordanceOptions );
      const actualDescribe = concordance.describe( actual, this.concordanceOptions );

      // Keep previous snapshot
      this.newSnapshots.set( this.testKey, expectedBuffer );
      this.reports.set( this.testKey, expectedDescribe );

      if ( concordance.compareDescriptors( expectedDescribe, actualDescribe ) ) {
        return;
      }

      throw new SnapshotMissmatch(
        concordance.diffDescriptors( expectedDescribe, actualDescribe, this.concordanceOptions )
      );

    }

  }

  async saveSnap() {
    if ( this.newSnapshots.size === 0 ) {
      if ( this.prevSnapshots.size > 0 ) {
        this.stats.removed = this.prevSnapshots.size;
        await fs.remove( this.snapPath );
      }
    } else {
      const p = fs.ensureDir( path.dirname( this.snapPath ) );
      const buffer = encode( this.newSnapshots );

      for ( const key of this.prevSnapshots.keys() ) {
        if ( !this.newSnapshots.has( key ) ) {
          this.stats.removed++;
        }
      }

      await p;
      await writeFileAtomic( this.snapPath, buffer );
    }
  }

  makeReport(): string {
    const lines = [ `# Quase-unit Snapshot Report for \`${this.filePath}\`\n` ];
    for ( const [ key, value ] of this.reports ) {
      lines.push( `## ${key}\n` );
      lines.push( "```" );
      lines.push(
        concordance.formatDescriptor( value, this.concordanceOptions )
      );
      lines.push( "```\n" );
    }
    return lines.join( "\n" );
  }

  async saveReport() {
    if ( this.reports.size === 0 ) {
      return;
    }
    await writeFileAtomic( this.reportPath, this.makeReport() );
  }

  save(): Promise<Stats> {
    return Promise.all( [
      this.saveSnap(),
      this.saveReport()
    ] ).then( () => this.stats );
  }

}
