import fs from "fs-extra";
import path from "path";
import _writeFileAtomic from "write-file-atomic";
import crypto from "crypto";
import zlib from "zlib";
import concordance, {
  type Options as ConcordanceOpts,
  type Descriptor,
} from "concordance";
import { concordanceOptions } from "./concordance-options";
import { prettify, prettifyPath } from "../../../../util/path-url";

// TODO https://github.com/avajs/ava/pull/3323/files
// TODO https://sindresorhus.com/blog/goodbye-nodejs-buffer

export type SnapshotStats = {
  added: number;
  updated: number;
  removed: number;
  obsolete: number;
};

function writeFileAtomic(filename: string, data: string | Buffer) {
  return new Promise<void>((resolve, reject) => {
    _writeFileAtomic(filename, data, {}, (err: Error | undefined) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export class SnapshotMissmatch {
  readonly expectedDescribe: Descriptor;
  readonly actualDescribe: Descriptor;

  constructor(expectedDescribe: Descriptor, actualDescribe: Descriptor) {
    this.expectedDescribe = expectedDescribe;
    this.actualDescribe = actualDescribe;
  }
}

export class SnapshotMissing {
  readonly expectedDescribe: Descriptor;
  readonly actualDescribe: Descriptor;

  constructor(actualDescribe: Descriptor) {
    this.expectedDescribe = concordance.describe(undefined, concordanceOptions);
    this.actualDescribe = actualDescribe;
  }
}

type SnapLoc = undefined | string | ((file: string) => string);

function getFile(
  projectDir: string,
  filePath: string,
  snapshotLocation: SnapLoc
): string {
  if (snapshotLocation) {
    if (typeof snapshotLocation === "string") {
      const relative = path.relative(projectDir, filePath);
      return path.resolve(projectDir, snapshotLocation, relative);
    }
    if (typeof snapshotLocation === "function") {
      const out = snapshotLocation(filePath);
      if (typeof out === "string") {
        return path.resolve(projectDir, out);
      }
    }
    throw new Error(
      `Expected 'snapshotLocation' to be a 'string' or 'string => string'`
    );
  }
  return path.resolve(filePath, "..", "__snapshots__", path.basename(filePath));
}

export default class SnapshotsManager {
  private filePath: string;
  private snapPath: string;
  private reportPath: string;
  private decodingError: Error | null;
  private snapshotKeys: Map<string, number>;
  private prevSnapshots: ReadonlyMap<string, Buffer>;
  private newSnapshots: Map<
    string,
    {
      key: string;
      title: string;
      describe: Descriptor;
      buffer: Buffer;
    }
  >;
  private matches: { key: string; title: string }[];
  private updating: boolean;
  private stats: SnapshotStats;
  private concordanceOptions: ConcordanceOpts;

  constructor(
    projectDir: string,
    filePath: string,
    snapshotLocation: SnapLoc,
    updating: boolean
  ) {
    const file = getFile(projectDir, filePath, snapshotLocation);
    this.filePath = filePath;
    this.snapPath = file + ".snap";
    this.reportPath = file + ".md";
    this.decodingError = null;
    this.snapshotKeys = new Map();
    this.prevSnapshots = new Map();
    this.newSnapshots = new Map();
    this.matches = [];
    this.updating = updating;
    this.stats = {
      added: 0,
      updated: 0,
      removed: 0,
      obsolete: 0,
    };
    this.concordanceOptions = concordanceOptions;
  }

  async load() {
    try {
      this.prevSnapshots = decode(
        await fs.readFile(this.snapPath),
        this.snapPath
      );
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        this.decodingError = err;
      }
    }
  }

  matchesSnapshot(_key: string, title: string, something: unknown) {
    if (this.decodingError) {
      throw this.decodingError;
    }

    const index = this.snapshotKeys.get(_key) ?? 1;
    this.snapshotKeys.set(_key, index + 1);

    const testKey = _key + " " + index;

    this.matches.push({
      key: testKey,
      title,
    });

    const actualDescribe = concordance.describe(
      something,
      this.concordanceOptions
    );

    const expectedBuffer = this.prevSnapshots.get(testKey);

    if (this.updating) {
      const actualBuffer = concordance.serialize(actualDescribe);

      // Add new snapshot
      this.newSnapshots.set(testKey, {
        key: testKey,
        title,
        describe: actualDescribe,
        buffer: actualBuffer,
      });

      if (expectedBuffer == null) {
        this.stats.added++;
      } else if (!expectedBuffer.equals(actualBuffer)) {
        this.stats.updated++;
      }

      return true;
    }

    if (expectedBuffer == null) {
      return new SnapshotMissing(actualDescribe);
    }

    const expectedDescribe = concordance.deserialize(
      expectedBuffer,
      this.concordanceOptions
    );

    if (concordance.compareDescriptors(expectedDescribe, actualDescribe)) {
      return true;
    }

    return new SnapshotMissmatch(expectedDescribe, actualDescribe);
  }

  async save(): Promise<SnapshotStats> {
    for (const key of this.prevSnapshots.keys()) {
      if (!this.newSnapshots.has(key)) {
        if (this.updating) {
          this.stats.removed++;
        } else {
          this.stats.obsolete++;
        }
      }
    }

    if (this.updating) {
      if (this.newSnapshots.size === 0) {
        await Promise.all([
          fs.remove(this.snapPath),
          fs.remove(this.reportPath),
        ]);
      } else {
        if (this.stats.added || this.stats.updated || this.stats.removed) {
          const p = fs.ensureDir(path.dirname(this.snapPath));
          const buffer = encode(this.newSnapshots);
          const report = this.makeReport();

          await p;
          await Promise.all([
            writeFileAtomic(this.snapPath, buffer),
            writeFileAtomic(this.reportPath, report),
          ]);
        }
      }
    }

    return this.stats;
  }

  makeReport(): string {
    const lines = [
      `# Quase-unit Snapshot Report for \`${prettify(this.filePath)}\`\n`,
    ];
    for (const { title, describe } of this.newSnapshots.values()) {
      lines.push(`## ${title}\n`);
      lines.push("```");
      lines.push(
        concordance.formatDescriptor(describe, this.concordanceOptions)
      );
      lines.push("```\n");
    }
    return lines.join("\n");
  }
}

const MD5_HASH_LENGTH = 16;

// Update this on major updates of concordance or quase-unit
const HEADER = "Quase-unit Snapshot v1";

class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

class ChecksumError extends SnapshotError {
  snapPath: string;
  constructor(snapPath: string) {
    super(`Checksum mismatch (${prettifyPath(snapPath)})`);
    this.name = "ChecksumError";
    this.snapPath = snapPath;
  }
}

class HeaderMismatchError extends SnapshotError {
  snapPath: string;
  actual: string;
  expected: string;
  constructor(header: string, snapPath: string) {
    super(`Unexpected snapshot header (${prettifyPath(snapPath)})`);
    this.name = "HeaderMismatchError";
    this.snapPath = snapPath;
    this.actual = header;
    this.expected = HEADER;
  }
}

class ReadableBuffer {
  buffer: Buffer;
  byteOffset: number;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.byteOffset = 0;
  }

  readLine(): Buffer {
    const start = this.byteOffset;
    const index = this.buffer.indexOf("\n", start);
    this.byteOffset = index + 1;
    return this.buffer.subarray(start, index);
  }

  readLineString(): string {
    return this.readLine().toString();
  }

  readAmount(size: number): Buffer {
    const start = this.byteOffset;
    this.byteOffset += size;
    return this.buffer.subarray(start, start + size);
  }

  readLeft(): Buffer {
    const start = this.byteOffset;
    this.byteOffset = this.buffer.length;
    return this.buffer.subarray(start);
  }

  canRead(): boolean {
    return this.byteOffset !== this.buffer.length;
  }
}

class WritableBuffer {
  entries: Buffer[];
  size: number;

  constructor() {
    this.entries = [];
    this.size = 0;
  }

  write(buffer: Buffer) {
    this.entries.push(buffer);
    this.size += buffer.length;
  }

  writeLineString(str: string) {
    this.write(Buffer.from(str + "\n"));
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.entries, this.size);
  }
}

export function encode(
  snapshots: ReadonlyMap<string, { buffer: Buffer }>
): Buffer {
  const buffer = new WritableBuffer();

  for (const key of Array.from(snapshots.keys()).sort()) {
    const value = snapshots.get(key)!.buffer;
    buffer.writeLineString(key);
    buffer.writeLineString(value.length + "");
    buffer.write(value);
  }

  const compressed = zlib.gzipSync(buffer.toBuffer());
  compressed[9] = 0x03; // Override the GZip header containing the OS to always be Linux
  const md5sum = crypto.createHash("md5").update(compressed).digest();

  const finalBuffer = new WritableBuffer();
  finalBuffer.writeLineString(HEADER);
  finalBuffer.write(md5sum);
  finalBuffer.write(compressed);
  return finalBuffer.toBuffer();
}

export function decode(
  _buffer: Buffer,
  snapPath: string
): ReadonlyMap<string, Buffer> {
  const snapshots = new Map();

  const wrapperBuffer = new ReadableBuffer(_buffer);

  const header = wrapperBuffer.readLineString();
  if (header !== HEADER) {
    throw new HeaderMismatchError(header, snapPath);
  }

  const expectedSum = wrapperBuffer.readAmount(MD5_HASH_LENGTH);

  const compressed = wrapperBuffer.readLeft();

  const actualSum = crypto.createHash("md5").update(compressed).digest();

  if (!actualSum.equals(expectedSum)) {
    throw new ChecksumError(snapPath);
  }

  const decompressed = zlib.gunzipSync(compressed);
  const buffer = new ReadableBuffer(decompressed);

  while (buffer.canRead()) {
    const key = buffer.readLineString();
    const length = Number(buffer.readLineString());
    const value = buffer.readAmount(length);
    snapshots.set(key, value);
  }

  return snapshots;
}
