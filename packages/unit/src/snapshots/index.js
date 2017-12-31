// @flow
import { encode, decode, type Snapshots } from "./encode-decode";

const originalFs = require( "fs-extra" );
const path = require( "path" );
const concordance = require( "concordance" );
const _writeFileAtomic = require( "write-file-atomic" );
const { prettify } = require( "@quase/path-url" );
const isCi = require( "is-ci" );

type FS = {
  writeFileAtomic( string, any, ?Object ): Promise<void>,
  readFileSync( string ): Buffer,
  remove( string ): Promise<void>,
  ensureDir( string ): Promise<void>
};

function writeFileAtomic( filename, data, options ) {
  return new Promise( ( resolve, reject ) => {
    _writeFileAtomic( filename, data, options, err => {
      if ( err ) {
        reject( err );
      } else {
        resolve();
      }
    } );
  } );
}

function tryDecode( fs: FS, file: string ): [ Snapshots, ?Error ] {
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
  +expectedDescribe: Object;
  +actualDescribe: Object;
  constructor( expectedDescribe: Object, actualDescribe: Object ) {
    super( "Snapshot missmatch" );
    this.name = "SnapshotMissmatch";
    this.expectedDescribe = expectedDescribe;
    this.actualDescribe = actualDescribe;
  }
}

class SnapshotMissing extends Error {
  +expectedDescribe: Object;
  +actualDescribe: Object;
  constructor( actualDescribe: Object ) {
    super( "Snapshot missing. Note that snapshots are not created automatically when in a CI environment." );
    this.name = "SnapshotMissing";
    this.expectedDescribe = concordance.describe( undefined );
    this.actualDescribe = actualDescribe;
  }
}

type Stats = { added: number, updated: number, removed: number, obsolete: number };

function getFile( projectDir: string, filePath: string, fixedLocation: ?string ) {
  if ( fixedLocation ) {
    const relative = path.relative( projectDir, filePath );
    return path.resolve( projectDir, fixedLocation, relative );
  }
  return path.resolve( filePath, "..", "__snapshots__", path.basename( filePath ) );
}

export default class SnapshotsManager {

  +filePath: string;
  +snapPath: string;
  +reportPath: string;
  +decodingError: ?Error;
  +prevSnapshots: Snapshots;
  +newSnapshots: Snapshots;
  +testKeys: Map<string, number>;
  +reports: Map<string, Object>;
  +updating: boolean;
  +stats: Stats;
  +concordanceOptions: Object;
  +fs: FS;

  constructor(
    projectDir: string,
    filePath: string,
    fixedLocation: ?string,
    updating: ?boolean,
    concordanceOptions: Object,
    fs: ?FS
  ) {
    const file = getFile( projectDir, filePath, fixedLocation );
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
    this.reports = new Map();
    this.updating = !!updating;
    this.stats = {
      added: 0,
      updated: 0,
      removed: 0,
      obsolete: 0
    };
    this.concordanceOptions = { plugins: concordanceOptions.plugins };
  }

  matchesSnapshot( _key: string, title: string, actualBuffer: Buffer ) {

    if ( this.decodingError ) {
      throw this.decodingError;
    }

    const index = this.testKeys.get( _key ) || 1;
    this.testKeys.set( _key, index + 1 );

    const testKey = _key + " " + index;

    const actualDescribe = concordance.deserialize( actualBuffer, this.concordanceOptions );

    const expectedBuffer = this.prevSnapshots.get( testKey );

    if ( expectedBuffer === undefined && isCi && !this.updating ) {

      throw new SnapshotMissing( actualDescribe );

    } else if ( expectedBuffer === undefined || this.updating ) {

      // Add new snapshot
      this.newSnapshots.set( testKey, actualBuffer );
      this.reports.set( title, actualDescribe );

      if ( expectedBuffer === undefined ) {
        this.stats.added++;
      } else if ( !expectedBuffer.equals( actualBuffer ) ) {
        this.stats.updated++;
      }

    } else {

      const expectedDescribe = concordance.deserialize( expectedBuffer, this.concordanceOptions );

      // Keep previous snapshot
      this.newSnapshots.set( testKey, expectedBuffer );
      this.reports.set( title, expectedDescribe );

      if ( concordance.compareDescriptors( expectedDescribe, actualDescribe ) ) {
        return;
      }

      throw new SnapshotMissmatch( expectedDescribe, actualDescribe );

    }

  }

  async save(): Promise<Stats> {
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
    for ( const [ title, value ] of this.reports ) {
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
