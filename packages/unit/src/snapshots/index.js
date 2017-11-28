// @flow

import { plain as concordanceOptions } from "../core/concordance-options";
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
  +expectedDescribe: Object;
  +actualDescribe: Object;
  constructor( expectedDescribe: Object, actualDescribe: Object ) {
    super( "Snapshot missmatch" );
    this.name = "SnapshotMissmatch";
    this.expectedDescribe = expectedDescribe;
    this.actualDescribe = actualDescribe;
  }
}

type Stats = { added: number, removed: number, updated: number };

function getSnapPath( filePath: string ): string {
  return filePath + ".snap";
}

function getReportPath( filePath: string ): string {
  return filePath + ".md";
}

export default class SnapshotsManager {

  +filePath: string;
  +snapPath: string;
  +reportPath: string;
  +prevSnapshots: Snapshots;
  +newSnapshots: Snapshots;
  +reports: Map<string, Object>;
  +updating: boolean;
  +stats: Stats;

  constructor( filePath: string, updating: ?boolean ) {
    this.filePath = filePath;
    this.snapPath = getSnapPath( filePath );
    this.reportPath = getReportPath( filePath );
    this.prevSnapshots = tryDecode( this.snapPath );
    this.newSnapshots = new Map();
    this.reports = new Map();
    this.updating = !!updating;
    this.stats = {
      added: 0,
      removed: 0,
      updated: 0
    };
  }

  toMatchSnapshot( testKey: string, actual: mixed ) {

    if ( this.newSnapshots && this.newSnapshots.has( testKey ) ) {
      throw new Error( `Key ${testKey} was already used.` );
    }

    const expectedBuffer = this.prevSnapshots.get( testKey );

    if ( expectedBuffer === undefined || this.updating ) {

      const actualDescribe = concordance.describe( actual, concordanceOptions );
      const actualBuffer = concordance.serialize( actualDescribe );

      // Add new snapshot
      this.newSnapshots.set( testKey, actualBuffer );
      this.reports.set( testKey, actualDescribe );

      if ( expectedBuffer === undefined ) {
        this.stats.added++;
      } else if ( !expectedBuffer.equals( actualBuffer ) ) {
        this.stats.updated++;
      }

    } else {

      const expectedDescribe = concordance.deserialize( expectedBuffer, concordanceOptions );
      const actualDescribe = concordance.describe( actual, concordanceOptions );

      // Keep previous snapshot
      this.newSnapshots.set( testKey, expectedBuffer );
      this.reports.set( testKey, expectedDescribe );

      if ( concordance.compareDescriptors( expectedDescribe, actualDescribe ) ) {
        return;
      }

      throw new SnapshotMissmatch( expectedDescribe, actualDescribe );

    }

  }

  async save(): Promise<Stats> {
    if ( this.newSnapshots.size === 0 ) {
      if ( this.prevSnapshots.size > 0 ) {
        this.stats.removed = this.prevSnapshots.size;
        await Promise.all( [
          fs.remove( this.snapPath ),
          fs.remove( this.reportPath )
        ] );
      }
    } else {
      for ( const key of this.prevSnapshots.keys() ) {
        if ( !this.newSnapshots.has( key ) ) {
          this.stats.removed++;
        }
      }

      if ( this.stats.added || this.stats.updated || this.stats.removed ) {
        const p = fs.ensureDir( path.dirname( this.snapPath ) );
        const buffer = encode( this.newSnapshots );
        const report = this.makeReport();

        await p;
        await Promise.all( [
          writeFileAtomic( this.snapPath, buffer ),
          writeFileAtomic( this.reportPath, report )
        ] );
      }
    }

    return this.stats;
  }

  makeReport(): string {
    const lines = [ `# Quase-unit Snapshot Report for \`${this.filePath}\`\n` ];
    for ( const [ key, value ] of this.reports ) {
      lines.push( `## ${key}\n` );
      lines.push( "```" );
      lines.push(
        concordance.formatDescriptor( value, concordanceOptions )
      );
      lines.push( "```\n" );
    }
    return lines.join( "\n" );
  }

}
