import originalFs from "fs-extra";
import path from "path";
import _writeFileAtomic from "write-file-atomic";
import { prettify } from "@quase/path-url";
import isCi from "is-ci";
import { encode, decode, Snapshots } from "./encode-decode";
import { SnapshotStats } from "../types";

const concordance = require( "concordance" );

function writeFileAtomic( filename: string, data: string | Buffer, options?: any ) {
  return new Promise<void>( ( resolve, reject ) => {
    _writeFileAtomic( filename, data, options, ( err: Error | undefined ) => {
      if ( err ) {
        reject( err );
      } else {
        resolve();
      }
    } );
  } );
}

type FS = {
  writeFileAtomic( filename: string, data: string | Buffer, options?: any ): Promise<void>;
  readFileSync( file: string ): Buffer;
  remove( file: string ): Promise<void>;
  ensureDir( file: string ): Promise<void>;
};

function tryDecode( fs: FS, file: string ): [ Snapshots, Error | null ] {
  try {
    return [ decode( fs.readFileSync( file ), file ), null ];
  } catch ( err ) {
    if ( err.code === "ENOENT" ) {
      return [ new Map(), null ];
    }
    return [ new Map(), err ];
  }
}

class SnapshotMissmatch extends Error {
  expectedDescribe: any;
  actualDescribe: any;
  constructor( expectedDescribe: any, actualDescribe: any ) {
    super( "Snapshot missmatch" );
    this.name = "SnapshotMissmatch";
    this.expectedDescribe = expectedDescribe;
    this.actualDescribe = actualDescribe;
  }
}

class SnapshotMissing extends Error {
  expectedDescribe: any;
  actualDescribe: any;
  constructor( actualDescribe: any ) {
    super( "Snapshot missing. Note that snapshots are not created automatically when in a CI environment." );
    this.name = "SnapshotMissing";
    this.expectedDescribe = concordance.describe( undefined );
    this.actualDescribe = actualDescribe;
  }
}

type SnapLoc = undefined | string | ( ( file: string ) => string );

function getFile( projectDir: string, filePath: string, snapshotLocation: SnapLoc ): string {
  if ( snapshotLocation ) {
    if ( typeof snapshotLocation === "string" ) {
      const relative = path.relative( projectDir, filePath );
      return path.resolve( projectDir, snapshotLocation, relative );
    }
    if ( typeof snapshotLocation === "function" ) {
      const out = snapshotLocation( filePath );
      if ( typeof out === "string" ) {
        return path.resolve( projectDir, out );
      }
    }
    throw new Error( `Expected 'snapshotLocation' to be a 'string' or 'string => string'` );
  }
  return path.resolve( filePath, "..", "__snapshots__", path.basename( filePath ) );
}

export default class SnapshotsManager {

  private filePath: string;
  private snapPath: string;
  private reportPath: string;
  private decodingError: Error | null;
  private prevSnapshots: Snapshots;
  private newSnapshots: Snapshots;
  private testKeys: Map<string, number>;
  private describesForReports: Map<string, any>;
  private updating: boolean;
  private stats: SnapshotStats;
  private concordanceOptions: any;
  private fs: FS;

  constructor( projectDir: string, filePath: string, snapshotLocation: SnapLoc, updating: boolean, concordanceOptions: any, fs?: FS ) {
    const file = getFile( projectDir, filePath, snapshotLocation );
    this.filePath = filePath;
    this.snapPath = file + ".snap";
    this.reportPath = file + ".md";
    this.fs = fs || {
      writeFileAtomic,
      readFileSync: originalFs.readFileSync,
      remove: originalFs.remove,
      ensureDir: originalFs.ensureDir
    };
    const decoded = tryDecode( this.fs, this.snapPath );
    this.decodingError = decoded[ 1 ];
    this.prevSnapshots = decoded[ 0 ];
    this.newSnapshots = new Map();
    this.testKeys = new Map();
    this.describesForReports = new Map();
    this.updating = !!updating;
    this.stats = {
      added: 0,
      updated: 0,
      removed: 0,
      obsolete: 0
    };
    this.concordanceOptions = { plugins: concordanceOptions.plugins };
  }

  matchesSnapshot( _key: string, title: string, something: unknown ) {

    if ( this.decodingError ) {
      throw this.decodingError;
    }

    const index = this.testKeys.get( _key ) || 1;
    this.testKeys.set( _key, index + 1 );

    const testKey = _key + " " + index;

    const actualDescribe = concordance.describe( something, this.concordanceOptions );
    const actualBuffer = concordance.serialize( actualDescribe );

    const expectedBuffer = this.prevSnapshots.get( testKey );

    if ( expectedBuffer === undefined && isCi && !this.updating ) {

      throw new SnapshotMissing( actualDescribe );

    } else if ( expectedBuffer === undefined || this.updating ) {

      // Add new snapshot
      this.newSnapshots.set( testKey, actualBuffer );
      this.describesForReports.set( title, actualDescribe );

      if ( expectedBuffer === undefined ) {
        this.stats.added++;
      } else if ( !expectedBuffer.equals( actualBuffer ) ) {
        this.stats.updated++;
      }

    } else {

      const expectedDescribe = concordance.deserialize( expectedBuffer, this.concordanceOptions );

      // Keep previous snapshot
      this.newSnapshots.set( testKey, expectedBuffer );
      this.describesForReports.set( title, expectedDescribe );

      if ( concordance.compareDescriptors( expectedDescribe, actualDescribe ) ) {
        return;
      }

      throw new SnapshotMissmatch( expectedDescribe, actualDescribe );

    }

  }

  async save(): Promise<SnapshotStats> {
    if ( this.newSnapshots.size === 0 ) {
      if ( this.prevSnapshots.size > 0 ) {
        if ( this.updating ) {
          this.stats.removed = this.prevSnapshots.size;
          await Promise.all( [
            this.fs.remove( this.snapPath ),
            this.fs.remove( this.reportPath )
          ] );
        } else {
          this.stats.obsolete = this.prevSnapshots.size;
        }
      }
    } else {
      for ( const key of this.prevSnapshots.keys() ) {
        if ( !this.newSnapshots.has( key ) ) {
          if ( this.updating ) {
            this.stats.removed++;
          } else {
            this.stats.obsolete++;
          }
        }
      }

      if ( this.stats.added || this.stats.updated || this.stats.removed ) {
        const p = this.fs.ensureDir( path.dirname( this.snapPath ) );
        const buffer = encode( this.newSnapshots );
        const report = this.makeReport();

        await p;
        await Promise.all( [
          this.fs.writeFileAtomic( this.snapPath, buffer ),
          this.fs.writeFileAtomic( this.reportPath, report )
        ] );
      }
    }

    return this.stats;
  }

  makeReport(): string {
    const lines = [ `# Quase-unit Snapshot Report for \`${prettify( this.filePath )}\`\n` ];
    for ( const [ title, value ] of this.describesForReports ) {
      lines.push( `## ${title}\n` );
      lines.push( "```" );
      lines.push(
        concordance.formatDescriptor( value, this.concordanceOptions )
      );
      lines.push( "```\n" );
    }
    return lines.join( "\n" );
  }

}
