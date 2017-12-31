// @flow

const { prettifyPath } = require( "@quase/path-url" );
const crypto = require( "crypto" );
const zlib = require( "zlib" );

const MD5_HASH_LENGTH = 16;

// Update this on major updates of concordance or quase-unit
const HEADER = "Quase-unit Snapshot v1";

class SnapshotError extends Error {
  constructor( message: string ) {
    super( message );
    this.name = "SnapshotError";
  }
}

class ChecksumError extends SnapshotError {
  +snapPath: string;
  constructor( snapPath: string ) {
    super( `Checksum mismatch (${prettifyPath( snapPath )})` );
    this.name = "ChecksumError";
    this.snapPath = snapPath;
  }
}

class HeaderMismatchError extends SnapshotError {
  +snapPath: string;
  +actual: string;
  +expected: string;
  constructor( header: string, snapPath: string ) {
    super( `Unexpected snapshot header (${prettifyPath( snapPath )})` );
    this.name = "HeaderMismatchError";
    this.snapPath = snapPath;
    this.actual = header;
    this.expected = HEADER;
  }
}

class ReadableBuffer {
  +buffer: Buffer;
  byteOffset: number;

  constructor( buffer: Buffer ) {
    this.buffer = buffer;
    this.byteOffset = 0;
  }

  readLine(): Buffer {
    const start = this.byteOffset;
    const index = this.buffer.indexOf( "\n", start );
    this.byteOffset = index + 1;
    return this.buffer.slice( start, index );
  }

  readLineString(): string {
    return this.readLine().toString();
  }

  readAmount( size: number ): Buffer {
    const start = this.byteOffset;
    this.byteOffset += size;
    return this.buffer.slice( start, start + size );
  }

  readLeft(): Buffer {
    const start = this.byteOffset;
    this.byteOffset = this.buffer.length;
    return this.buffer.slice( start );
  }

  canRead(): boolean {
    return this.byteOffset !== this.buffer.length;
  }
}

class WritableBuffer {
  +entries: Buffer[];
  size: number;

  constructor() {
    this.entries = [];
    this.size = 0;
  }

  write( buffer: Buffer ) {
    this.entries.push( buffer );
    this.size += buffer.length;
  }

  writeLineString( str: string ) {
    this.write( Buffer.from( str + "\n" ) );
  }

  toBuffer(): Buffer {
    return Buffer.concat( this.entries, this.size );
  }
}

export type Snapshots = Map<string, Buffer>;

export function encode( snapshots: Snapshots ): Buffer {

  const buffer = new WritableBuffer();

  for ( const key of Array.from( snapshots.keys() ).sort() ) {
    // $FlowFixMe
    const value: Buffer = snapshots.get( key );
    buffer.writeLineString( key );
    buffer.writeLineString( value.length + "" );
    buffer.write( value );
  }

  const compressed = zlib.gzipSync( buffer.toBuffer() );
  const md5sum = crypto.createHash( "md5" ).update( compressed ).digest();

  const finalBuffer = new WritableBuffer();
  finalBuffer.writeLineString( HEADER );
  finalBuffer.write( md5sum );
  finalBuffer.write( compressed );
  return finalBuffer.toBuffer();
}

export function decode( _buffer: Buffer, snapPath: string ): Snapshots {

  const snapshots: Snapshots = new Map();

  const wrapperBuffer = new ReadableBuffer( _buffer );

  const header = wrapperBuffer.readLineString();
  if ( header !== HEADER ) {
    throw new HeaderMismatchError( header, snapPath );
  }

  const expectedSum = wrapperBuffer.readAmount( MD5_HASH_LENGTH );

  const compressed = wrapperBuffer.readLeft();

  const actualSum = crypto.createHash( "md5" ).update( compressed ).digest();

  if ( !actualSum.equals( expectedSum ) ) {
    throw new ChecksumError( snapPath );
  }

  const decompressed = zlib.gunzipSync( compressed );
  const buffer = new ReadableBuffer( decompressed );

  while ( buffer.canRead() ) {
    const key = buffer.readLineString();
    const length = Number( buffer.readLineString() );
    const value = buffer.readAmount( length );
    snapshots.set( key, value );
  }

  return snapshots;
}
